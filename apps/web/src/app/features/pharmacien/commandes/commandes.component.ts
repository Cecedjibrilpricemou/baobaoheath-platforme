// features/pharmacien/commandes/commandes.component.ts
//
// La file du comptoir : les appels du quartier, et ce que l'officine a pris
// (P6 / EF-07).
//
// **Une course, pas une file d'attente.** Toutes les pharmacies partenaires du
// quartier reçoivent le même appel, et la première qui déclare détenir la
// totalité prend la commande. L'attribution est atomique côté serveur : deux
// réponses simultanées donnent un gagnant et un perdant, jamais deux gagnants.
// L'écran doit donc assumer qu'une commande visible peut déjà être partie.
//
// **Répondre « je n'ai pas tout » est définitif pour cette officine** : l'appel
// disparaît de sa file. L'écran le dit avant, pas après.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import type { CommandeView } from '@baobaoheath/shared-types';
import { PharmacienService } from '../../../core/services/pharmacien.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-pharmacien-commandes',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './commandes.component.html',
})
export class PharmacienCommandesComponent implements OnInit {
  private pharma = inject(PharmacienService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  commandes = signal<CommandeView[]>([]);
  chargement = signal(true);
  /** La commande sur laquelle une réponse est en cours. */
  enCours = signal<string | null>(null);
  /** Celle dont on s'apprête à dire qu'on ne l'a pas : on demande confirmation. */
  confirmeRefus = signal<CommandeView | null>(null);

  /** Les appels auxquels cette officine n'a pas encore répondu. */
  readonly appels = computed(() =>
    this.commandes().filter((c) => c.statut === 'RECHERCHE_PHARMACIE'));

  /** Ce qu'elle a pris, et qu'il faut préparer. */
  readonly miennes = computed(() =>
    this.commandes().filter((c) => c.statut === 'PRISE_EN_CHARGE' && c.estLaMienne));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.pharma.commandesDeLaPharmacie().subscribe({
      next: (r) => {
        this.commandes.set(r.data ?? []);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        const e = err as { error?: { error?: string } };
        // Une officine non partenaire reçoit un message precis cote API :
        // le repeter evite de chercher du cote des droits.
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  /** Nombre total de boîtes à sortir : ce qu'on regarde avant de s'engager. */
  totalBoites(c: CommandeView): number {
    return c.lignes.reduce((t, l) => t + l.quantite, 0);
  }

  /** Combien d'officines ont déjà dit non : le contexte de sa propre réponse. */
  refusAvant(c: CommandeView): number {
    return c.reponses.filter((r) => !r.aTousLesProduits).length;
  }

  // ── Répondre ───────────────────────────────────────────────────────
  /**
   * « J'ai tout » : l'officine tente de prendre la commande.
   *
   * Un 409 n'est pas une panne — une autre a été plus rapide. On le dit
   * comme tel et on relit la file, au lieu d'afficher une erreur.
   */
  jePrends(c: CommandeView): void {
    if (this.enCours()) return;
    this.enCours.set(c.id);
    this.pharma.repondreDisponibilite(c.id, true).subscribe({
      next: () => {
        this.enCours.set(null);
        this.toastr.success(this.i18n.t('PHARMACIEN.COMMANDES.PRISE_OK'));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { status?: number; error?: { error?: string } };
        if (e?.status === 409) {
          this.toastr.info(this.i18n.t('PHARMACIEN.COMMANDES.TROP_TARD'));
        } else {
          this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
        }
        this.charger();
      },
    });
  }

  demanderRefus(c: CommandeView): void {
    this.confirmeRefus.set(c);
  }

  fermerRefus(): void {
    this.confirmeRefus.set(null);
  }

  /** « Je n'ai pas tout » : l'appel quitte définitivement sa file. */
  confirmerRefus(): void {
    const c = this.confirmeRefus();
    if (!c || this.enCours()) return;
    this.enCours.set(c.id);
    this.pharma.repondreDisponibilite(c.id, false).subscribe({
      next: () => {
        this.enCours.set(null);
        this.confirmeRefus.set(null);
        this.toastr.info(this.i18n.t('PHARMACIEN.COMMANDES.REFUS_OK'));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  /**
   * L'officine rend une commande qu'elle avait prise : elle n'avait pas tout,
   * finalement. Le verrou se rouvre et les autres retrouvent la main.
   */
  rendre(c: CommandeView): void {
    const motif = window.prompt(this.i18n.t('PHARMACIEN.COMMANDES.MOTIF_PROMPT'))?.trim() ?? '';
    if (motif.length < 5) {
      if (motif.length > 0) this.toastr.error(this.i18n.t('PHARMACIEN.COMMANDES.MOTIF_COURT'));
      return;
    }
    this.enCours.set(c.id);
    this.pharma.retirerPriseEnCharge(c.id, motif).subscribe({
      next: () => {
        this.enCours.set(null);
        this.toastr.info(this.i18n.t('PHARMACIEN.COMMANDES.RENDUE'));
        this.charger();
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { error?: { error?: string } };
        this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'));
      },
    });
  }

  /**
   * Le dosage, sauf quand le libellé le porte déjà.
   *
   * « Doliprane Pricemou 500mg 500mg » : le catalogue met souvent le dosage
   * dans le nom, et l'afficher à côté le répète.
   */
  dosageUtile(libelle: string, dosage?: string | null): string | null {
    if (!dosage) return null;
    return libelle.toLowerCase().includes(dosage.toLowerCase()) ? null : dosage;
  }

  libelleMode(m: string | null | undefined): string {
    return m ? this.i18n.t(`PHARMACIEN.COMMANDES.MODE_${m}`) : '';
  }
}
