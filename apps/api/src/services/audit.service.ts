import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';
import { getRequestId } from '../utils/request-context';

const SENSITIVE_KEYS = new Set([
  'motDePasse',
  'motDePasseActuel',
  'nouveauMotDePasse',
  'motDePasseHash',
  'refreshToken',
  'accessToken',
  'token',
  'twoFaSecret',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitize(item),
    ])
  );
}

function shouldAudit(req: Request): boolean {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;

  return req.method === 'GET' && (
    req.originalUrl.includes('/patients') ||
    req.originalUrl.includes('/consultations') ||
    req.originalUrl.includes('/fhir') ||
    req.originalUrl.includes('/analytics/export') ||
    // Scanner un QR patient, c'est consulter son dossier : le geste laisse une
    // trace, au meme titre qu'une lecture de fiche. Ni le scan du comptoir
    // pharmacie ni celui du laboratoire n'etaient traces jusqu'au 2026-09-29.
    //
    // La reserve qui figurait ici est levee depuis le 2026-10-03 : le patient
    // concerne vit maintenant dans la colonne indexee `idPatientConcerne`
    // (voir `patientConcerne`), et non plus seulement dans
    // `metadonnees.params.qrCode`. « Qui a consulte mon dossier ? » se repond
    // donc par une requete indexee.
    req.originalUrl.includes('/scan/') ||
    // Consulter le journal d'audit est un acces aux dossiers de tous les
    // patients a la fois : c'est l'ecran le plus sensible du produit
    // (EF-12-05). Sans cette ligne, le seul endroit d'ou l'on voit tout
    // serait le seul qu'on ne verrait pas — et le journal ne prouverait plus
    // rien le jour ou il faudrait s'en servir.
    req.originalUrl.includes('/journal')
  );
}

function resourceFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.findIndex((segment) => segment === 'v1');
  return segments[apiIndex + 1] ?? segments[0] ?? 'unknown';
}

/**
 * Le chemin complet de la requete, prefixe de montage compris.
 *
 * **A ne pas remplacer par `req.path`.** Dans un routeur monte, Express
 * tronque `req.url` — donc `req.path` — du prefixe de montage : pour
 * `/api/v1/patients/abc`, le middleware voit `/abc`. `resourceFromPath`
 * cherchant le segment `v1`, elle ne le trouvait jamais et retombait sur le
 * premier segment restant. D'ou, dans la base de demonstration du
 * 2026-10-03 : 288 lignes de ressource « me », 120 « unknown », et un
 * identifiant de patient pris pour un nom de ressource.
 *
 * `req.originalUrl` n'est jamais modifie, lui. Il porte la chaine de requete,
 * qu'on retire : sans cela, `GET /api/v1/patients?page=1` donnerait la
 * ressource « patients?page=1 ». Les criteres vivent deja dans
 * `metadonnees.query`.
 */
function cheminComplet(req: AuthRequest): string {
  const brut = req.originalUrl ?? req.path ?? '';
  return brut.split('?')[0] ?? '';
}

/**
 * La ressource telle qu'elle est enregistree au journal, donc telle qu'on la
 * recherchera (EF-12-05). Exportee pour etre eprouvee directement : c'est une
 * colonne de recherche, et elle etait fausse jusqu'au 2026-10-03.
 */
export function ressourceDeLaRequete(req: AuthRequest): string {
  return resourceFromPath(cheminComplet(req));
}

function premiereChaine(valeurs: unknown[]): string | null {
  for (const v of valeurs) if (typeof v === 'string' && v.trim() !== '') return v;
  return null;
}

/**
 * Pour une ressource rattachee a un patient, la requete qui remonte au
 * patient. Une seule lecture indexee par cas.
 *
 * La cle est ce que rend `resourceFromPath`, c'est-a-dire le premier segment
 * apres `/api/v1`.
 */
const REMONTE_AU_PATIENT: Record<
  string,
  (id: string) => Promise<{ idPatient: string } | null>
> = {
  consultations: (id) =>
    prisma.consultation.findUnique({ where: { id }, select: { idPatient: true } }),
  episodes: (id) =>
    prisma.episodeSoins.findUnique({ where: { id }, select: { idPatient: true } }),
  vaccinations: (id) =>
    prisma.vaccination.findUnique({ where: { id }, select: { idPatient: true } }),
  // L'ordonnance n'a pas d'`idPatient` : elle appartient a une consultation,
  // qui le porte. C'est une consequence du choix de modele consigne dans le
  // pack de reprise — l'ordonnance est un document, pas un medicament.
  ordonnances: async (id) => {
    const o = await prisma.ordonnance.findUnique({
      where: { id },
      select: { consultation: { select: { idPatient: true } } },
    });
    return o ? { idPatient: o.consultation.idPatient } : null;
  },
};

/**
 * Le patient dont le dossier a ete touche par cette requete (EF-02-08).
 *
 * Jusqu'au 2026-10-03, « qui a consulte mon dossier ? » ne se repondait qu'en
 * fouillant `metadonnees`, du JSON non indexe : le scan d'un QR ne laissait le
 * patient que dans `metadonnees.params.qrCode`. Cette fonction remonte
 * l'information dans une colonne indexee.
 *
 * **Ce qu'elle ne peut pas determiner, et c'est assume** : une route de liste
 * ou de recherche (`GET /patients/recherche`, `GET /consultations`) ne touche
 * pas un dossier mais plusieurs, ou aucun. Lui attribuer un patient serait
 * mentir. Ces lignes restent sans patient nomme ; elles sont tracees, avec
 * leur auteur, leur heure et leurs criteres de recherche dans `metadonnees`,
 * mais elles n'apparaitront pas dans le journal d'un patient donne. Couvrir
 * ce cas demanderait de journaliser chaque resultat rendu, donc une ligne par
 * patient affiche — un choix a trancher, pas un oubli.
 */
export async function patientConcerne(req: AuthRequest): Promise<string | null> {
  // 1. Le patient est donne explicitement.
  //
  // Cette valeur vient de la requete, donc d'une source non fiable, et la cle
  // etrangere est en RESTRICT : un identifiant inexistant ferait echouer
  // l'insertion, et **l'acces ne serait pas trace du tout**. Autrement dit,
  // envoyer un `idPatient` fantaisiste suffirait a effacer sa propre trace.
  // On verifie donc son existence avant de s'en servir. La route elle-meme
  // reste libre de refuser la requete pour ses propres raisons : ici on ne
  // juge pas la requete, on journalise ce qu'elle a touche.
  const explicite = premiereChaine([
    (req.params as Record<string, unknown> | undefined)?.['idPatient'],
    (req.query as Record<string, unknown> | undefined)?.['idPatient'],
    (req.body as Record<string, unknown> | undefined)?.['idPatient'],
  ]);
  if (explicite) {
    const p = await prisma.patientProfile.findUnique({
      where: { id: explicite },
      select: { id: true },
    });
    if (p) return p.id;
  }

  // 2. Un QR scanne au comptoir : c'est exactement le geste que le patient
  //    doit pouvoir retrouver dans son journal.
  const qrCode = premiereChaine([(req.params as Record<string, unknown> | undefined)?.['qrCode']]);
  if (qrCode) {
    const p = await prisma.patientProfile.findUnique({ where: { qrCode }, select: { id: true } });
    if (p) return p.id;
  }

  const ressource = ressourceDeLaRequete(req);
  const id = premiereChaine([(req.params as Record<string, unknown> | undefined)?.['id']]);

  // 3. La ressource visee EST le patient. Meme precaution qu'au cas 1 :
  //    `/patients/:id` accepte n'importe quelle chaine dans l'URL.
  if (ressource === 'patients' && id) {
    const p = await prisma.patientProfile.findUnique({ where: { id }, select: { id: true } });
    if (p) return p.id;
  }

  // 4. Une ressource rattachee a un patient.
  if (id) {
    const remonte = REMONTE_AU_PATIENT[ressource];
    if (remonte) {
      const trouve = await remonte(id);
      if (trouve) return trouve.idPatient;
    }
  }

  // 5. Le patient lit son propre dossier (`/me/...`). Ces acces comptent :
  //    le journal doit distinguer « j'ai ouvert mon dossier » de « quelqu'un
  //    d'autre l'a ouvert », et pour cela il faut les deux.
  if (req.user?.role === 'PATIENT') {
    const p = await prisma.patientProfile.findUnique({
      where: { idUtilisateur: req.user.userId },
      select: { id: true },
    });
    if (p) return p.id;
  }

  return null;
}

export function auditRequest(req: AuthRequest, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (!req.user || !shouldAudit(req)) return;
    const utilisateur = req.user;

    // La resolution du patient demande au plus une lecture indexee. Elle est
    // ici, dans `finish`, donc hors du chemin de la reponse : le patient
    // n'attend pas que son dossier soit journalise.
    //
    // Si elle echoue, la ligne est ecrite quand meme, sans patient nomme : un
    // journal incomplet vaut mieux qu'un acces non trace.
    const ligne = (idPatientConcerne: string | null) => ({
      idUtilisateur: utilisateur.userId,
      action: `${req.method} ${req.route?.path ?? req.path}`,
      ressource: ressourceDeLaRequete(req),
      idRessource: typeof req.params?.id === 'string' ? req.params.id : undefined,
      idPatientConcerne,
      statutHttp: res.statusCode,
      ipAdresse: req.ip,
      userAgent: req.get('user-agent'),
      metadonnees: sanitize({
        requestId: getRequestId(),
        statusCode: res.statusCode,
        originalUrl: req.originalUrl,
        params: req.params,
        query: req.query,
        body: req.body,
      }) as object,
    });

    void patientConcerne(req)
      .catch((error: unknown) => {
        logger.warn('Audit : patient concerne non resolu', { error });
        return null;
      })
      .then(async (idPatientConcerne) => {
        try {
          await prisma.journalAudit.create({ data: ligne(idPatientConcerne) });
        } catch (error: unknown) {
          // Dernier filet : quelle que soit la raison, l'acces doit laisser
          // une trace. Une ligne sans patient nomme reste une ligne ; une
          // ligne absente est un acces invisible.
          if (idPatientConcerne === null) throw error;
          logger.error('Audit : ecriture refusee avec le patient, reecrite sans', { error });
          await prisma.journalAudit.create({ data: ligne(null) });
        }
      })
      .catch((error: unknown) => {
        logger.error('Audit log failed', { error });
      });
  });

  next();
}
