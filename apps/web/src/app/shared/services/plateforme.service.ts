// shared/services/plateforme.service.ts
// Identite de la plateforme (nom, logo, coordonnees) : chargee une fois au
// demarrage depuis GET /parametres/publics, exposee en signaux. C'est la
// seule source du nom affiche — nulle part ailleurs il n'est ecrit en dur.
// Le super-admin la modifie depuis Parametres > Identite ; appliquer() met
// l'interface a jour sans rechargement.
import { Injectable, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { catchError, firstValueFrom, of } from 'rxjs';
import type { IdentitePlateformeView } from '@baobaoheath/shared-types';
import { ApiService } from '../../core/services/api.service';

/** Valeurs affichees tant que l'API n'a pas repondu (ou si elle est injoignable). */
export const IDENTITE_PAR_DEFAUT: IdentitePlateformeView = {
  nom: 'Plateforme',
  nomCourt: 'PLATEFORME',
  slogan: '',
  logoUrl: '',
  adresse: '',
  ville: '',
  pays: '',
  telephone: '',
  telephoneSupport: '',
  emailContact: '',
  emailSupport: '',
  emailExpediteur: '',
  siteWeb: '',
  facebook: '',
  whatsapp: '',
  copyright: '',
  devise: 'GNF',
};

@Injectable({ providedIn: 'root' })
export class PlateformeService {
  private api   = inject(ApiService);
  private title = inject(Title);

  private identiteSignal = signal<IdentitePlateformeView>(IDENTITE_PAR_DEFAUT);

  readonly identite = this.identiteSignal.asReadonly();
  readonly nom      = computed(() => this.identiteSignal().nom);
  readonly slogan   = computed(() => this.identiteSignal().slogan);
  readonly logoUrl  = computed(() => this.identiteSignal().logoUrl);
  readonly devise   = computed(() => this.identiteSignal().devise);
  readonly copyright = computed(() => this.identiteSignal().copyright);
  /** « Ville, Pays » ou l'adresse complete si elle est renseignee. */
  readonly adresseComplete = computed(() => {
    const i = this.identiteSignal();
    return [i.adresse, i.ville, i.pays].map((p) => p.trim()).filter(Boolean).join(', ');
  });
  readonly emailContact = computed(() => this.identiteSignal().emailContact);
  readonly telephone    = computed(() => this.identiteSignal().telephone);

  /** Appele au demarrage (app.config) ; ne bloque jamais l'application si l'API est absente. */
  async charger(): Promise<void> {
    const reponse = await firstValueFrom(
      this.api.get<{ success: boolean; data: IdentitePlateformeView }>('/parametres/publics')
        .pipe(catchError(() => of(null)))
    );
    if (reponse?.data) this.appliquer(reponse.data);
  }

  /**
   * Met a jour l'identite en memoire (apres une sauvegarde depuis les
   * parametres). Les derives sont recalcules ici comme cote API, car la
   * sauvegarde renvoie les valeurs brutes (copyright vide = mention generee).
   */
  appliquer(identite: IdentitePlateformeView): void {
    const nom = identite.nom.trim() || IDENTITE_PAR_DEFAUT.nom;
    this.identiteSignal.set({
      ...IDENTITE_PAR_DEFAUT,
      ...identite,
      nom,
      copyright: identite.copyright.trim() || `© ${new Date().getFullYear()} ${nom} — Tous droits réservés`,
    });
    this.title.setTitle(nom);
  }
}
