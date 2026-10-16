// features/patient/commandes/commandes.component.ts
//
// Les commandes du patient, et le choix du mode de remise (P6 / EF-07).
//
// **Le retrait n'est pas un repli.** Beaucoup de patients habitent à côté
// d'une pharmacie et iront chercher eux-mêmes ; la livraison n'est jamais
// imposée. Les deux choix se présentent à égalité, et aucun n'est
// présélectionné.
//
// Le patient ne voyait rien jusqu'ici : l'appel partait, une pharmacie
// prenait la commande, et c'est à lui de dire comment être servi — sans
// qu'aucun écran ne le lui demande.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import type { CommandeView, ModePaiement, ModeRemise } from '@baobaoheath/shared-types';
import { PatientService } from '../../../core/services/patient.service';
import { ColonneExport, ExportListeComponent } from '../../../shared/components/export-liste/export-liste.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-patient-commandes',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ExportListeComponent],
  templateUrl: './commandes.component.html',
})
export class PatientCommandesComponent implements OnInit {
  private patient = inject(PatientService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  commandes = signal<CommandeView[]>([]);

  readonly colonnes: ColonneExport<CommandeView>[] = [
    { titre: 'EXPORT.COL.ORDONNANCE', valeur: (c) => c.numeroOrdonnance },
    { titre: 'EXPORT.COL.PHARMACIE', valeur: (c) => c.pharmacie?.nom },
    { titre: 'EXPORT.COL.QUARTIER', valeur: (c) => c.pharmacie?.quartier ?? c.quartierRecherche },
    { titre: 'EXPORT.COL.LIGNES', valeur: (c) => c.lignes.length, nombre: true },
    { titre: 'EXPORT.COL.REMISE', valeur: (c) => c.modeRemise },
    { titre: 'EXPORT.COL.STATUT', valeur: (c) => c.statut },
    { titre: 'EXPORT.COL.DEMANDEE_LE', valeur: (c) => new Date(c.creeLe) },
  ];
  chargement = signal(true);
  enCours = signal<string | null>(null);

  /**
   * Celles qu'une pharmacie a prises et qui avancent.
   *
   * **Toute la vie de la commande tient sur cette carte** : le choix du mode,
   * le montant quand il arrive, le paiement, puis l'attente. Separer chaque
   * etat en section obligerait le patient a chercher sa commande ailleurs
   * chaque fois qu'elle avance.
   */
  readonly prises = computed(() =>
    this.commandes().filter((c) => !['RECHERCHE_PHARMACIE', 'SANS_PHARMACIE', 'CLOTUREE', 'ANNULEE']
      .includes(c.statut)));

  /** Ce qui est termine, pour memoire. */
  readonly terminees = computed(() =>
    this.commandes().filter((c) => ['CLOTUREE', 'ANNULEE'].includes(c.statut)));

  /** La commande qu'on paie, et ce qu'on a saisi. */
  cible = signal<CommandeView | null>(null);
  modePaiement = signal<ModePaiement>('ORANGE_MONEY');
  numeroOperateur = signal('');

  /** Celle a laquelle on renonce, et pourquoi. */
  renonce = signal<CommandeView | null>(null);
  motif = signal('');

  /** Celles qui cherchent encore une officine. */
  readonly enRecherche = computed(() =>
    this.commandes().filter((c) => c.statut === 'RECHERCHE_PHARMACIE'));

  /** Celles qu'aucune pharmacie du quartier n'a pu servir. */
  readonly sansPharmacie = computed(() =>
    this.commandes().filter((c) => c.statut === 'SANS_PHARMACIE'));

  // ── Le montant, et le paiement (P6 / EF-07-02) ──────────────────────

  /** Le libelle de l'etat : le patient doit savoir ce qu'on attend de lui. */
  libelleEtat(statut: string): string {
    return this.i18n.t(`PATIENT.COMMANDES.ETAT_${statut}`);
  }

  montant(gnf: number | null | undefined): string {
    return gnf == null ? '—' : new Intl.NumberFormat('fr-FR').format(gnf);
  }

  readonly modes: ReadonlyArray<{ valeur: ModePaiement; libelle: string }> = [
    { valeur: 'ORANGE_MONEY', libelle: 'Orange Money' },
    { valeur: 'MTN_MOMO', libelle: 'MTN MoMo' },
    { valeur: 'ESPECES', libelle: 'Especes' },
  ];

  ouvrirPaiement(c: CommandeView): void {
    this.modePaiement.set('ORANGE_MONEY');
    this.numeroOperateur.set('');
    this.cible.set(c);
  }

  fermerPaiement(): void {
    this.cible.set(null);
  }

  /** Le mobile money demande un numero ; les especes non. */
  peutPayer(): boolean {
    if (this.enCours()) return false;
    if (this.modePaiement() === 'ESPECES') return true;
    return this.numeroOperateur().trim().length >= 6;
  }

  /**
   * Lancer le paiement.
   *
   * **Aucun montant n'est envoye** : il est fige en base au chiffrage. Ce qui
   * revient est la facture, avec son lien — et c'est le rappel de la
   * passerelle qui fera avancer la commande, jamais cet ecran. Rien ne se
   * decide tout seul ici : ni compte a rebours, ni redirection, parce qu'un
   * paiement mobile prend une minute comme cinq.
   */
  payer(): void {
    const c = this.cible();
    if (!c || !this.peutPayer()) return;
    this.enCours.set(c.id);

    const numero = this.numeroOperateur().trim();
    this.patient.payerCommande(c.id, {
      modePaiement: this.modePaiement(),
      ...(numero ? { numeroOperateur: numero } : {}),
    }).subscribe({
      next: (r) => {
        this.enCours.set(null);
        this.cible.set(null);
        const url = r.data?.urlPaiement;
        if (url) {
          // Un nouvel onglet : le patient revient sur la plateforme ensuite,
          // et ne perd pas sa place.
          window.open(url, '_blank', 'noopener');
          this.toastr.info(this.i18n.t('PATIENT.COMMANDES.PAIEMENT_OUVERT'));
        } else {
          this.toastr.info(this.i18n.t('PATIENT.COMMANDES.PAIEMENT_ESPECES'));
        }
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  // ── Renoncer ────────────────────────────────────────────────────────

  demanderRenoncement(c: CommandeView): void {
    this.motif.set('');
    this.renonce.set(c);
  }

  fermerRenoncement(): void {
    this.renonce.set(null);
  }

  peutRenoncer(): boolean {
    return !this.enCours() && this.motif().trim().length >= 5;
  }

  confirmerRenoncement(): void {
    const c = this.renonce();
    if (!c || !this.peutRenoncer()) return;
    this.enCours.set(c.id);
    this.patient.annulerCommande(c.id, this.motif().trim()).subscribe({
      next: () => {
        this.enCours.set(null);
        this.renonce.set(null);
        this.toastr.success(this.i18n.t('PATIENT.COMMANDES.RENONCE_OK'));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.patient.mesCommandes().subscribe({
      next: (r) => {
        this.commandes.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.toastr.error(this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  totalBoites(c: CommandeView): number {
    return c.lignes.reduce((t, l) => t + l.quantite, 0);
  }

  /**
   * Le dosage, sauf quand le libellé le porte déjà : le catalogue l'y met
   * souvent, et l'afficher à côté le répète.
   */
  dosageUtile(libelle: string, dosage?: string | null): string | null {
    if (!dosage) return null;
    return libelle.toLowerCase().includes(dosage.toLowerCase()) ? null : dosage;
  }

  choisir(c: CommandeView, mode: ModeRemise): void {
    if (this.enCours()) return;
    this.enCours.set(c.id);
    this.patient.choisirModeRemise(c.id, mode).subscribe({
      next: () => {
        this.enCours.set(null);
        this.toastr.success(this.i18n.t(`PATIENT.COMMANDES.CHOISI_${mode}`));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  libelleMode(m: string | null | undefined): string {
    return m ? this.i18n.t(`PATIENT.COMMANDES.MODE_${m}`) : '';
  }
}
