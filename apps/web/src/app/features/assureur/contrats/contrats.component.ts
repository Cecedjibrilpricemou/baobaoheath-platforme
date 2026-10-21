// features/assureur/contrats — les contrats de la compagnie (lot assurance).
//
// Deux familles, chacune avec ses taux :
//   - les contrats collectifs d'entreprise, et leurs beneficiaires (une
//     adhesion et une carte par personne) ;
//   - les polices individuelles.
//
// Les taux propres a une police priment sur ceux de la compagnie : c'est ce
// qui permet a deux entreprises d'avoir des pourcentages differents.
//
// Une personne s'ajoute par sa fiche d'identite (piece et photo) : son compte
// patient est cree s'il n'existe pas, ou retrouve par son telephone. Pour une
// entreprise, la liste du personnel peut aussi s'importer en CSV.
//
// Chaque champ est un signal : l'application est zoneless, et un `ngModel`
// qui ecrirait dans un objet ordinaire ne notifierait personne.
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import type {
  AdhesionAssuranceView,
  AssureView,
  CategorieProduit,
  ContratCollectifView,
  PersonneAssureeView,
  PersonneEnregistreeView,
  RapportImportTravailleursView,
  TypeCouverture,
} from '@baobaoheath/shared-types';
import { enCsv } from '@baobaoheath/shared-types';

import { AssureurService } from '../../../core/services/assureur.service';
import { CategorieProduitPipe } from '../../../shared/pipes/categorie-produit.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { FormulairePersonneComponent } from '../formulaire-personne/formulaire-personne.component';

/** Les categories de l'enum Prisma, dans l'ordre ou on les rencontre. */
const CATEGORIES: CategorieProduit[] = [
  'MEDICAMENT', 'LAIT_INFANTILE', 'COMPLEMENT_ALIMENTAIRE', 'COSMETIQUE',
  'HYGIENE', 'PARAPHARMACIE', 'DISPOSITIF_MEDICAL', 'AUTRE',
];

type Onglet = 'COLLECTIFS' | 'INDIVIDUELS';

/** Les colonnes du modele d'import, dans l'ordre ou l'API les lit. */
const COLONNES_MODELE = [
  'nom', 'prenoms', 'sexe', 'date_naissance', 'lieu_naissance', 'nationalite', 'type_piece', 'numero_piece',
  'date_delivrance', 'date_expiration', 'telephone', 'adresse', 'prefecture', 'numero_adherent', 'date_effet',
];

/** Propose un fichier au navigateur, sans passer par le serveur. */
function telecharger(contenu: string, nom: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Un entier saisi, ou `undefined` si le champ est vide. */
function entier(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

@Component({
  selector: 'app-assureur-contrats',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, CategorieProduitPipe, TranslatePipe, FormulairePersonneComponent,
  ],
  templateUrl: './contrats.component.html',
  styleUrl: './contrats.component.scss',
})
export class AssureurContratsComponent implements OnInit, OnDestroy {
  private service = inject(AssureurService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  readonly categories = CATEGORIES;
  onglet = signal<Onglet>('COLLECTIFS');
  enCours = signal(false);

  // ── Contrats collectifs ──────────────────────────────────────────
  contrats = signal<ContratCollectifView[]>([]);
  chargementContrats = signal(true);
  selection = signal<ContratCollectifView | null>(null);
  adhesions = signal<AdhesionAssuranceView[]>([]);

  formContrat = signal(false);
  raisonSociale = signal('');
  identifiantLegal = signal('');
  numeroContrat = signal('');
  nomRegime = signal('');
  tauxContrat = signal<number | null>(80);
  plafondContrat = signal<number | null>(null);
  franchiseContrat = signal<number | null>(null);
  debutContrat = signal('');
  finContrat = signal('');
  carenceContrat = signal<number | null>(null);
  graceContrat = signal<number | null>(null);

  nouvelleEcheance = signal('');

  // ── Ajouter une personne : fiche d'identite, photo, compte ──────
  /** Le formulaire d'identite ouvert ; un seul a la fois. */
  formulaire = viewChild(FormulairePersonneComponent);
  formTravailleur = signal(false);
  numeroAdherent = signal('');
  debutAdhesion = signal('');
  finAdhesion = signal('');
  /** Le dernier enregistrement : il porte le mot de passe temporaire, rendu une seule fois. */
  enregistrement = signal<PersonneEnregistreeView | null>(null);

  // ── Import de la liste du personnel ──────────────────────────────
  formImport = signal(false);
  rapportImport = signal<RapportImportTravailleursView | null>(null);

  // ── Fiche ouverte pour mise a jour ───────────────────────────────
  personneEnEdition = signal<PersonneAssureeView | null>(null);
  photoEdition = signal<string | null>(null);

  /** Les photos des listes, par fiche : des URL d'objet, liberees en sortant. */
  miniatures = signal<Record<string, string>>({});

  // ── Fin d'adhesion ───────────────────────────────────────────────
  adhesionATerminer = signal<AdhesionAssuranceView | null>(null);
  motifFin = signal('');
  dateFinAdhesion = signal('');

  // ── Regle propre a une police ────────────────────────────────────
  cibleRegle = signal<{ type: TypeCouverture; id: string; libelle: string } | null>(null);
  categorieRegle = signal<CategorieProduit>('MEDICAMENT');
  exclusionRegle = signal(false);
  tauxRegle = signal<number | null>(null);
  plafondLigneRegle = signal<number | null>(null);
  dateEffetRegle = signal('');

  // ── Polices individuelles ────────────────────────────────────────
  polices = signal<AssureView[]>([]);
  chargementPolices = signal(true);
  formPolice = signal(false);
  numeroPolice = signal('');
  tauxPolice = signal<number | null>(80);
  plafondPolice = signal<number | null>(null);
  franchisePolice = signal<number | null>(null);
  debutPolice = signal('');
  finPolice = signal('');
  carencePolice = signal<number | null>(null);
  gracePolice = signal<number | null>(null);

  readonly peutCreerContrat = computed(() =>
    this.raisonSociale().trim().length >= 2 && this.numeroContrat().trim().length >= 2
    && this.nomRegime().trim().length >= 2 && this.tauxValide(this.tauxContrat())
    && !!this.debutContrat() && !!this.finContrat() && this.finContrat() > this.debutContrat()
  );

  readonly peutAjouterTravailleur = computed(() =>
    !!this.formulaire()?.valide() && this.numeroAdherent().trim().length >= 2
    && (!this.finAdhesion() || !this.debutAdhesion() || this.finAdhesion() >= this.debutAdhesion())
  );

  readonly peutCreerPolice = computed(() =>
    !!this.formulaire()?.valide() && this.numeroPolice().trim().length >= 2 && this.tauxValide(this.tauxPolice())
    && !!this.debutPolice() && (!this.finPolice() || this.finPolice() > this.debutPolice())
  );

  readonly peutAjouterRegle = computed(() =>
    !!this.cibleRegle() && (this.exclusionRegle() || this.tauxValide(this.tauxRegle()) || (entier(this.plafondLigneRegle()) ?? 0) > 0)
  );

  ngOnInit(): void {
    this.chargerContrats();
    this.chargerPolices();
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.miniatures())) URL.revokeObjectURL(url);
    this.libererPhotoEdition();
  }

  private tauxValide(t: number | null): boolean {
    const n = entier(t);
    return n !== undefined && n >= 0 && n <= 100;
  }

  private chargerContrats(idASelectionner?: string) {
    this.chargementContrats.set(true);
    this.service.contratsCollectifs().subscribe({
      next: (r) => {
        const contrats = r.data ?? [];
        this.contrats.set(contrats);
        this.chargementContrats.set(false);
        const id = idASelectionner ?? this.selection()?.id;
        const trouve = id ? contrats.find((c) => c.id === id) ?? null : null;
        this.selection.set(trouve);
      },
      error: (err) => {
        this.chargementContrats.set(false);
        this.signaler(err);
      },
    });
  }

  private chargerPolices() {
    this.chargementPolices.set(true);
    this.service.mesAssures().subscribe({
      next: (r) => {
        const polices = (r.data ?? []).filter((a) => a.typeCouverture === 'INDIVIDUELLE');
        this.polices.set(polices);
        this.chargementPolices.set(false);
        this.chargerMiniatures(polices.map((p) => p.personne));
      },
      error: (err) => {
        this.chargementPolices.set(false);
        this.signaler(err);
      },
    });
  }

  changerOnglet(o: Onglet) {
    this.onglet.set(o);
    this.fermerFormulaires();
    this.cibleRegle.set(null);
  }

  /** Ferme les formulaires de personne et d'import : un seul est ouvert a la fois. */
  fermerFormulaires() {
    this.formTravailleur.set(false);
    this.formPolice.set(false);
    this.formImport.set(false);
    this.rapportImport.set(null);
    this.numeroAdherent.set('');
    this.debutAdhesion.set('');
    this.finAdhesion.set('');
  }

  // ── Contrats collectifs ──────────────────────────────────────────

  creerContrat() {
    if (!this.peutCreerContrat() || this.enCours()) return;
    this.enCours.set(true);
    this.service.creerContratCollectif({
      entreprise: {
        raisonSociale: this.raisonSociale().trim(),
        ...(this.identifiantLegal().trim() ? { identifiantLegal: this.identifiantLegal().trim() } : {}),
      },
      numeroContrat: this.numeroContrat().trim(),
      nomRegime: this.nomRegime().trim(),
      tauxBasePourcent: entier(this.tauxContrat())!,
      plafondAnnuelGnf: entier(this.plafondContrat()),
      franchiseGnf: entier(this.franchiseContrat()),
      dateEffet: this.debutContrat(),
      dateFin: this.finContrat(),
      carenceJours: entier(this.carenceContrat()),
      periodeGraceJours: entier(this.graceContrat()),
    }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.formContrat.set(false);
        this.raisonSociale.set(''); this.identifiantLegal.set(''); this.numeroContrat.set('');
        this.nomRegime.set(''); this.plafondContrat.set(null); this.franchiseContrat.set(null);
        this.debutContrat.set(''); this.finContrat.set(''); this.carenceContrat.set(null); this.graceContrat.set(null);
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        this.chargerContrats(r.data?.id);
        if (r.data) this.ouvrir(r.data);
      },
      error: (err) => this.signaler(err),
    });
  }

  ouvrir(c: ContratCollectifView) {
    this.selection.set(c);
    this.fermerFormulaires();
    this.cibleRegle.set(null);
    this.adhesionATerminer.set(null);
    this.nouvelleEcheance.set('');
    this.chargerAdhesions(c.id);
  }

  private chargerAdhesions(idContrat: string) {
    this.service.adhesions(idContrat).subscribe({
      next: (r) => {
        const adhesions = r.data ?? [];
        this.adhesions.set(adhesions);
        this.chargerMiniatures(adhesions.map((a) => a.personne));
      },
      error: (err) => this.signaler(err),
    });
  }

  renouveler() {
    const c = this.selection();
    if (!c || !this.nouvelleEcheance() || this.enCours()) return;
    this.enCours.set(true);
    this.service.renouvelerContratCollectif(c.id, this.nouvelleEcheance()).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.nouvelleEcheance.set('');
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        this.chargerContrats(c.id);
      },
      error: (err) => this.signaler(err),
    });
  }

  // ── Ajouter un travailleur ou assurer une personne ───────────────

  ouvrirAjoutTravailleur() {
    this.fermerFormulaires();
    this.enregistrement.set(null);
    this.formTravailleur.set(true);
  }

  ajouterTravailleur() {
    const c = this.selection();
    const f = this.formulaire();
    if (!c || !f || !this.peutAjouterTravailleur() || this.enCours()) return;
    const photo = f.photo();
    this.enCours.set(true);
    this.service.ajouterTravailleur(c.id, {
      personne: f.donnees(),
      numeroAdherent: this.numeroAdherent().trim(),
      ...(this.debutAdhesion() ? { dateEffet: this.debutAdhesion() } : {}),
      ...(this.finAdhesion() ? { dateFin: this.finAdhesion() } : {}),
    }).subscribe({
      next: (r) => this.envoyerPhotoPuis(r.data!.personne.id, photo, () => {
        this.terminerEnregistrement(r.data!, r.message);
        this.chargerAdhesions(c.id);
        this.chargerContrats(c.id);
      }),
      error: (err) => this.signaler(err),
    });
  }

  /**
   * La photo part apres la fiche, qui doit exister pour la porter. Si elle
   * echoue, la personne reste enregistree : on le dit, et la photo s'ajoute
   * depuis sa fiche.
   */
  private envoyerPhotoPuis(idPersonne: string, photo: File | null, suite: () => void) {
    if (!photo) {
      suite();
      return;
    }
    this.service.envoyerPhoto(idPersonne, photo).subscribe({
      next: () => suite(),
      error: () => {
        this.toastr.warning(this.i18n.t('ASSUREUR.PERSONNE.PHOTO_NON_ENREGISTREE'), this.i18n.t('COMMON.ERROR_TITLE'));
        suite();
      },
    });
  }

  private terminerEnregistrement(r: PersonneEnregistreeView, message?: string) {
    this.enCours.set(false);
    this.fermerFormulaires();
    this.enregistrement.set(r);
    this.toastr.success(message ?? '', this.i18n.t('COMMON.SUCCESS'));
  }

  // ── La liste du personnel en CSV ─────────────────────────────────

  ouvrirImport() {
    this.fermerFormulaires();
    this.enregistrement.set(null);
    this.formImport.set(true);
  }

  telechargerModele() {
    telecharger(enCsv(COLONNES_MODELE, [[
      'Camara', 'Fanta', 'F', '02/06/1988', 'Kindia', 'Guinéenne', 'CARTE_NATIONALE', 'GN-123456',
      '15/01/2022', '15/01/2032', '620000000', 'Dixinn, Conakry', 'Conakry', 'EMP-001', '',
    ]]), 'modele-travailleurs.csv');
  }

  async importerFichier(evenement: Event) {
    const c = this.selection();
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!c || !fichier || this.enCours()) return;
    this.enCours.set(true);
    this.rapportImport.set(null);
    const contenu = await fichier.text();
    this.service.importerTravailleurs(c.id, contenu).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.rapportImport.set(r.data ?? null);
        this.chargerAdhesions(c.id);
        this.chargerContrats(c.id);
      },
      error: (err) => this.signaler(err),
    });
  }

  /** Le rapport, avec les mots de passe temporaires a remettre : il ne sera plus rendu. */
  telechargerRapport() {
    const r = this.rapportImport();
    if (!r) return;
    telecharger(enCsv(
      ['ligne', 'statut', 'nom', 'numero_adherent', 'mot_de_passe_temporaire', 'motif'],
      r.lignes.map((l) => [l.numero, l.statut, l.nom, l.numeroAdherent, l.motDePasseTemporaire, l.motif]),
    ), 'rapport-import-travailleurs.csv');
  }

  // ── La fiche d'une personne ──────────────────────────────────────

  ouvrirFiche(idPersonne: string) {
    this.fermerFormulaires();
    this.enregistrement.set(null);
    this.libererPhotoEdition();
    this.service.personne(idPersonne).subscribe({
      next: (r) => {
        const fiche = r.data ?? null;
        this.personneEnEdition.set(fiche);
        if (fiche?.photoDisponible) {
          this.service.photo(fiche.id).subscribe({
            next: (image) => this.photoEdition.set(URL.createObjectURL(image)),
            error: () => this.photoEdition.set(null),
          });
        }
      },
      error: (err) => this.signaler(err),
    });
  }

  enregistrerFiche() {
    const fiche = this.personneEnEdition();
    const f = this.formulaire();
    if (!fiche || !f || !f.valide() || this.enCours()) return;
    const modifications = f.modifications();
    const photo = f.photo();
    const terminer = () => {
      this.enCours.set(false);
      this.oublierMiniature(fiche.id);
      this.fermerFiche();
      this.toastr.success(this.i18n.t('ASSUREUR.PERSONNE.FICHE_ENREGISTREE'), this.i18n.t('COMMON.SUCCESS'));
      const c = this.selection();
      if (c) this.chargerAdhesions(c.id);
      this.chargerPolices();
    };
    this.enCours.set(true);
    if (Object.keys(modifications).length === 0) {
      this.envoyerPhotoPuis(fiche.id, photo, terminer);
      return;
    }
    this.service.modifierPersonne(fiche.id, modifications).subscribe({
      next: () => this.envoyerPhotoPuis(fiche.id, photo, terminer),
      error: (err) => this.signaler(err),
    });
  }

  fermerFiche() {
    this.personneEnEdition.set(null);
    this.libererPhotoEdition();
  }

  private libererPhotoEdition() {
    const url = this.photoEdition();
    if (url) URL.revokeObjectURL(url);
    this.photoEdition.set(null);
  }

  /** Les photos des fiches de la liste, chargees une seule fois chacune. */
  private chargerMiniatures(fiches: ({ id: string; photoDisponible: boolean } | null | undefined)[]) {
    const deja = this.miniatures();
    for (const f of fiches) {
      if (!f?.photoDisponible || deja[f.id]) continue;
      this.service.photo(f.id).subscribe({
        next: (image) => this.miniatures.update((m) => ({ ...m, [f.id]: URL.createObjectURL(image) })),
        error: () => undefined,
      });
    }
  }

  private oublierMiniature(idPersonne: string) {
    const url = this.miniatures()[idPersonne];
    if (!url) return;
    URL.revokeObjectURL(url);
    this.miniatures.update(({ [idPersonne]: _retiree, ...reste }) => reste);
  }

  demanderFin(a: AdhesionAssuranceView) {
    this.adhesionATerminer.set(a);
    this.motifFin.set('');
    this.dateFinAdhesion.set('');
  }

  confirmerFin() {
    const a = this.adhesionATerminer();
    const c = this.selection();
    if (!a || !c || this.motifFin().trim().length < 5 || this.enCours()) return;
    this.enCours.set(true);
    this.service.terminerAdhesion(a.id, {
      motif: this.motifFin().trim(),
      ...(this.dateFinAdhesion() ? { dateEffet: this.dateFinAdhesion() } : {}),
    }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.adhesionATerminer.set(null);
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        this.ouvrir(c);
        this.chargerContrats(c.id);
      },
      error: (err) => this.signaler(err),
    });
  }

  // ── Polices individuelles ────────────────────────────────────────

  ouvrirNouvellePolice() {
    this.fermerFormulaires();
    this.enregistrement.set(null);
    this.formPolice.set(true);
  }

  creerPolice() {
    const f = this.formulaire();
    if (!f || !this.peutCreerPolice() || this.enCours()) return;
    const photo = f.photo();
    this.enCours.set(true);
    this.service.assurerPersonne({
      personne: f.donnees(),
      police: {
        numeroPolice: this.numeroPolice().trim(),
        tauxBasePourcent: entier(this.tauxPolice()),
        plafondAnnuelGnf: entier(this.plafondPolice()),
        franchiseGnf: entier(this.franchisePolice()),
        dateEffet: this.debutPolice(),
        ...(this.finPolice() ? { dateFin: this.finPolice() } : {}),
        carenceJours: entier(this.carencePolice()),
        periodeGraceJours: entier(this.gracePolice()),
      },
    }).subscribe({
      next: (r) => this.envoyerPhotoPuis(r.data!.personne.id, photo, () => {
        this.numeroPolice.set(''); this.plafondPolice.set(null); this.franchisePolice.set(null);
        this.debutPolice.set(''); this.finPolice.set(''); this.carencePolice.set(null); this.gracePolice.set(null);
        this.terminerEnregistrement(r.data!, r.message);
        this.chargerPolices();
      }),
      error: (err) => this.signaler(err),
    });
  }

  // ── Taux propres a une police ────────────────────────────────────

  ouvrirRegle(type: TypeCouverture, id: string, libelle: string) {
    this.cibleRegle.set({ type, id, libelle });
    this.categorieRegle.set('MEDICAMENT');
    this.exclusionRegle.set(false);
    this.tauxRegle.set(null);
    this.plafondLigneRegle.set(null);
    this.dateEffetRegle.set('');
  }

  ajouterRegle() {
    const cible = this.cibleRegle();
    if (!cible || !this.peutAjouterRegle() || this.enCours()) return;
    const exclu = this.exclusionRegle();
    this.enCours.set(true);
    this.service.ajouterReglePolice({
      typeCouverture: cible.type,
      idContrat: cible.id,
      categorie: this.categorieRegle(),
      exclu,
      ...(!exclu && entier(this.tauxRegle()) !== undefined ? { tauxPourcent: entier(this.tauxRegle()) } : {}),
      ...(!exclu && entier(this.plafondLigneRegle()) ? { plafondLigneGnf: entier(this.plafondLigneRegle()) } : {}),
      ...(this.dateEffetRegle() ? { dateEffet: this.dateEffetRegle() } : {}),
    }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.cibleRegle.set(null);
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        if (cible.type === 'COLLECTIVE') this.chargerContrats(cible.id);
        else this.chargerPolices();
      },
      error: (err) => this.signaler(err),
    });
  }

  // ── Affichage ─────────────────────────────────────────────────────

  montant(gnf: number): string {
    return new Intl.NumberFormat('fr-FR').format(gnf);
  }

  libelleStatut(s: string): string {
    return this.i18n.t(`ASSUREUR.STATUT_${s}`);
  }

  /** La date du jour au format des champs `date`, pour borner les saisies. */
  aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private signaler(err: unknown) {
    this.enCours.set(false);
    const e = err as { status?: number; error?: { error?: string } };
    this.toastr.error(
      e?.status === 0 ? this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE') : e?.error?.error ?? this.i18n.t('COMMON.ERROR'),
      this.i18n.t('COMMON.ERROR_TITLE')
    );
  }
}
