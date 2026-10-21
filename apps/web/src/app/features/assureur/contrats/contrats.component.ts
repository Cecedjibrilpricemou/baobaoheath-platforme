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
// Chaque champ est un signal : l'application est zoneless, et un `ngModel`
// qui ecrirait dans un objet ordinaire ne notifierait personne.
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import type {
  AdhesionAssuranceView,
  AssureView,
  CategorieProduit,
  ContratCollectifView,
  PatientAssureurRechercheView,
  TypeCouverture,
} from '@baobaoheath/shared-types';

import { AssureurService } from '../../../core/services/assureur.service';
import { CategorieProduitPipe } from '../../../shared/pipes/categorie-produit.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

/** Les categories de l'enum Prisma, dans l'ordre ou on les rencontre. */
const CATEGORIES: CategorieProduit[] = [
  'MEDICAMENT', 'LAIT_INFANTILE', 'COMPLEMENT_ALIMENTAIRE', 'COSMETIQUE',
  'HYGIENE', 'PARAPHARMACIE', 'DISPOSITIF_MEDICAL', 'AUTRE',
];

type Onglet = 'COLLECTIFS' | 'INDIVIDUELS';

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
    MatRadioModule, MatSelectModule, CategorieProduitPipe, TranslatePipe,
  ],
  templateUrl: './contrats.component.html',
  styleUrl: './contrats.component.scss',
})
export class AssureurContratsComponent implements OnInit {
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

  // ── Rattacher une personne (adhesion ou police individuelle) ────
  telephone = signal('');
  resultats = signal<PatientAssureurRechercheView[]>([]);
  patientChoisi = signal<PatientAssureurRechercheView | null>(null);
  numeroAdherent = signal('');
  debutAdhesion = signal('');
  finAdhesion = signal('');

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

  readonly peutAjouterAdhesion = computed(() =>
    !!this.patientChoisi() && this.numeroAdherent().trim().length >= 2
  );

  readonly peutCreerPolice = computed(() =>
    !!this.patientChoisi() && this.numeroPolice().trim().length >= 2 && this.tauxValide(this.tauxPolice())
    && !!this.debutPolice() && (!this.finPolice() || this.finPolice() > this.debutPolice())
  );

  readonly peutAjouterRegle = computed(() =>
    !!this.cibleRegle() && (this.exclusionRegle() || this.tauxValide(this.tauxRegle()) || (entier(this.plafondLigneRegle()) ?? 0) > 0)
  );

  ngOnInit(): void {
    this.chargerContrats();
    this.chargerPolices();
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
        this.polices.set((r.data ?? []).filter((a) => a.typeCouverture === 'INDIVIDUELLE'));
        this.chargementPolices.set(false);
      },
      error: (err) => {
        this.chargementPolices.set(false);
        this.signaler(err);
      },
    });
  }

  changerOnglet(o: Onglet) {
    this.onglet.set(o);
    this.oublierPersonne();
    this.cibleRegle.set(null);
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
    this.oublierPersonne();
    this.cibleRegle.set(null);
    this.adhesionATerminer.set(null);
    this.nouvelleEcheance.set('');
    this.adhesions.set([]);
    this.service.adhesions(c.id).subscribe({
      next: (r) => this.adhesions.set(r.data ?? []),
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

  // ── Retrouver la personne, par son telephone exact ──────────────

  rechercher() {
    const tel = this.telephone().trim();
    if (!tel || this.enCours()) return;
    this.enCours.set(true);
    this.patientChoisi.set(null);
    this.service.rechercherPatient(tel).subscribe({
      next: (r) => {
        this.enCours.set(false);
        const trouves = r.data ?? [];
        this.resultats.set(trouves);
        if (trouves.length === 1) this.patientChoisi.set(trouves[0]!);
        if (trouves.length === 0) this.toastr.info(this.i18n.t('ASSUREUR.CONTRATS.AUCUNE_PERSONNE'));
      },
      error: (err) => this.signaler(err),
    });
  }

  oublierPersonne() {
    this.telephone.set('');
    this.resultats.set([]);
    this.patientChoisi.set(null);
    this.numeroAdherent.set('');
    this.debutAdhesion.set('');
    this.finAdhesion.set('');
  }

  ajouterAdhesion() {
    const c = this.selection();
    const p = this.patientChoisi();
    if (!c || !p || !this.peutAjouterAdhesion() || this.enCours()) return;
    this.enCours.set(true);
    this.service.ajouterAdhesion(c.id, {
      idPatient: p.id,
      numeroAdherent: this.numeroAdherent().trim(),
      ...(this.debutAdhesion() ? { dateEffet: this.debutAdhesion() } : {}),
      ...(this.finAdhesion() ? { dateFin: this.finAdhesion() } : {}),
    }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.oublierPersonne();
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        this.ouvrir(c);
        this.chargerContrats(c.id);
      },
      error: (err) => this.signaler(err),
    });
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

  creerPolice() {
    const p = this.patientChoisi();
    if (!p || !this.peutCreerPolice() || this.enCours()) return;
    this.enCours.set(true);
    this.service.creerContratIndividuel({
      idPatient: p.id,
      numeroPolice: this.numeroPolice().trim(),
      tauxBasePourcent: entier(this.tauxPolice()),
      plafondAnnuelGnf: entier(this.plafondPolice()),
      franchiseGnf: entier(this.franchisePolice()),
      dateEffet: this.debutPolice(),
      ...(this.finPolice() ? { dateFin: this.finPolice() } : {}),
      carenceJours: entier(this.carencePolice()),
      periodeGraceJours: entier(this.gracePolice()),
    }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.formPolice.set(false);
        this.oublierPersonne();
        this.numeroPolice.set(''); this.plafondPolice.set(null); this.franchisePolice.set(null);
        this.debutPolice.set(''); this.finPolice.set(''); this.carencePolice.set(null); this.gracePolice.set(null);
        this.toastr.success(r.message ?? '', this.i18n.t('COMMON.SUCCESS'));
        this.chargerPolices();
      },
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
