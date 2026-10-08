// features/patient/paiements/paiements.component.ts
//
// Les factures du patient, et le paiement par mobile money (EF-08).
//
// **Le paiement se termine ailleurs.** Le patient quitte la plateforme pour la
// page de la passerelle, tape son code sur son téléphone, et revient. Rien ne
// nous dit qu'il est revenu : l'écran doit donc savoir relire l'état, et le
// dire clairement tant qu'il ne le connaît pas.
//
// **Aucun compte à rebours, aucune redirection automatique.** Un paiement
// mobile peut prendre une minute comme cinq ; une page qui déciderait seule
// que « c'est trop long » dirait à quelqu'un qui vient de payer que son
// paiement a échoué.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import type { FactureView, ModePaiement } from '@baobaoheath/shared-types';
import { PaiementService } from '../../../core/services/paiement.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

/** En dessous, la passerelle refuse : verifie contre son bac a sable. */
const MIN_PASSERELLE_GNF = 3_000;

@Component({
  selector: 'app-patient-paiements',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, TranslatePipe,
  ],
  templateUrl: './paiements.component.html',
})
export class PatientPaiementsComponent implements OnInit {
  private service = inject(PaiementService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  factures = signal<FactureView[]>([]);
  chargement = signal(true);
  /** L'identifiant de la facture dont on attend une reponse. */
  enCours = signal<string | null>(null);

  /** La facture qu'on s'apprete a payer, quand on choisit le moyen. */
  choix = signal<FactureView | null>(null);
  modePaiement: ModePaiement = 'ORANGE_MONEY';
  numeroOperateur = '';

  readonly aRegler = computed(() => this.factures().filter((f) => f.statut !== 'PAYEE'));
  readonly reglees = computed(() => this.factures().filter((f) => f.statut === 'PAYEE'));

  readonly totalDu = computed(() =>
    this.aRegler().reduce((s, f) => s + f.montantGnf, 0));

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.chargement.set(true);
    this.service.getHistorique().subscribe({
      next: (r) => {
        this.factures.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.toastr.error(this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  // ── Payer ──────────────────────────────────────────────────────────
  /** Trop petit pour la passerelle : a regler au guichet. */
  tropPetit(f: FactureView): boolean {
    return f.montantGnf < MIN_PASSERELLE_GNF;
  }

  ouvrirChoix(f: FactureView): void {
    this.choix.set(f);
    this.modePaiement = 'ORANGE_MONEY';
    this.numeroOperateur = '';
  }

  fermerChoix(): void {
    this.choix.set(null);
  }

  peutPayer(): boolean {
    const f = this.choix();
    if (!f || !f.idConsultation || this.enCours()) return false;
    // L'operateur a besoin du numero pour envoyer la demande au telephone.
    return this.modePaiement === 'ESPECES' || this.numeroOperateur.trim().length >= 6;
  }

  payer(): void {
    const f = this.choix();
    if (!f?.idConsultation || !this.peutPayer()) return;
    this.enCours.set(f.id);

    this.service.ouvrirPaiement({
      idConsultation: f.idConsultation,
      montantGnf: f.montantGnf,
      modePaiement: this.modePaiement,
      ...(this.numeroOperateur.trim() ? { numeroOperateur: this.numeroOperateur.trim() } : {}),
    }).subscribe({
      next: (r) => {
        this.enCours.set(null);
        this.choix.set(null);
        this.charger();
        const url = r.data?.urlPaiement;
        if (url) this.ouvrirPage(url);
        else this.toastr.info(this.i18n.t('PATIENT.PAIEMENTS.ESPECES_GUICHET'));
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  /**
   * Un nouvel onglet, pas une redirection.
   *
   * Remplacer la page ferait perdre au patient l'endroit d'où il vient : au
   * retour, il tomberait sur la page de la passerelle et non sur ses factures.
   */
  ouvrirPage(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  /** Relire l'etat : le serveur interroge la passerelle au passage. */
  actualiser(f: FactureView): void {
    this.enCours.set(f.id);
    this.service.getStatut(f.id).subscribe({
      next: (r) => {
        this.enCours.set(null);
        const maj = r.data;
        if (!maj) return;
        this.factures.update((liste) => liste.map((x) => (x.id === maj.id ? maj : x)));
        if (maj.statut === 'PAYEE') {
          this.toastr.success(this.i18n.t('PATIENT.PAIEMENTS.CONFIRME'));
        }
      },
      error: () => {
        this.enCours.set(null);
        this.toastr.error(this.i18n.t('PATIENT.PAIEMENTS.RELECTURE_KO'));
      },
    });
  }

  // ── Affichage ──────────────────────────────────────────────────────
  montant(gnf: number): string {
    return new Intl.NumberFormat('fr-FR').format(gnf);
  }

  /**
   * Ce que le dernier essai a donné, en français.
   *
   * Dire « échoué » sans dire quoi faire laisse le patient devant un mur : les
   * libellés disent tous la suite.
   */
  libelleEtat(f: FactureView): string {
    if (f.statut === 'PAYEE') return this.i18n.t('PATIENT.PAIEMENTS.ETAT_PAYEE');
    switch (f.statutOperateur) {
      case 'pending': return this.i18n.t('PATIENT.PAIEMENTS.ETAT_EN_COURS');
      case 'canceled': return this.i18n.t('PATIENT.PAIEMENTS.ETAT_ANNULE');
      case 'failed':
      case 'error': return this.i18n.t('PATIENT.PAIEMENTS.ETAT_ECHOUE');
      case 'expired': return this.i18n.t('PATIENT.PAIEMENTS.ETAT_EXPIRE');
      default: return this.i18n.t('PATIENT.PAIEMENTS.ETAT_A_REGLER');
    }
  }

  /** Un essai qui a mal tourné se signale, sans alarmer sur une attente. */
  aEchoue(f: FactureView): boolean {
    return f.statut !== 'PAYEE'
      && ['canceled', 'failed', 'error', 'expired'].includes(f.statutOperateur ?? '');
  }

  libelleMode(m: string | null | undefined): string {
    return m ? this.i18n.t(`PATIENT.PAIEMENTS.MODE_${m}`) : '—';
  }
}
