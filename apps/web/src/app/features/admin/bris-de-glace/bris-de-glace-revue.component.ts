// features/admin/bris-de-glace/bris-de-glace-revue.component.ts
//
// Relire les accès d'urgence (EF-02-06).
//
// **C'est cet écran qui fait du bris de glace autre chose qu'un journal.** Un
// garde-fou que personne ne relit n'en est pas un : sans relecture, déclarer
// un accès reviendrait à le prendre, et la contrainte serait purement
// décorative.
//
// L'écran dit aussi ce que relire ne veut *pas* dire : un accès jugé non fondé
// est un constat écrit, pas une sanction. Les suites se décident ailleurs, et
// le laisser croire ferait hésiter les relecteurs.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { BrisDeGlaceView } from '@baobaoheath/shared-types';
import { BrisDeGlaceService } from '../../../core/services/bris-de-glace.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** La même longueur que l'API : un avis qui ne dit rien ne prouve pas qu'on a regardé. */
const AVIS_MIN = 20;

@Component({
  selector: 'app-bris-de-glace-revue',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule,
  ],
  templateUrl: './bris-de-glace-revue.component.html',
  styleUrl: './bris-de-glace-revue.component.scss',
})
export class BrisDeGlaceRevueComponent implements OnInit {
  private service = inject(BrisDeGlaceService);
  private i18n = inject(I18nService);

  avisMin = AVIS_MIN;

  acces = signal<BrisDeGlaceView[]>([]);
  chargement = signal(true);
  aRevoirSeulement = signal(true);
  succes = signal('');
  erreur = signal('');

  // ── La boîte de relecture ──────────────────────────────────────────
  cible = signal<BrisDeGlaceView | null>(null);
  avis = signal('');
  enCours = signal(false);

  peutEnregistrer = computed(() =>
    !this.enCours() && this.avis().trim().length >= AVIS_MIN
  );

  aRevoir = computed(() => this.acces().filter((b) => b.statutRevue === 'A_REVOIR').length);

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.chargement.set(true);
    this.erreur.set('');
    this.service.lister(this.aRevoirSeulement()).subscribe({
      next: (res) => {
        this.acces.set(res.data ?? []);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(err, 'BRIS_DE_GLACE.ERREUR'));
      },
    });
  }

  basculerFiltre(valeur: boolean) {
    this.aRevoirSeulement.set(valeur);
    this.charger();
  }

  ouvrir(b: BrisDeGlaceView) {
    this.cible.set(b);
    this.avis.set('');
    this.erreur.set('');
  }

  fermer() {
    this.cible.set(null);
  }

  /** `statut` est explicite : juger demande un geste, pas un défaut. */
  juger(statut: 'JUSTIFIE' | 'INJUSTIFIE') {
    const b = this.cible();
    if (!b || !this.peutEnregistrer()) return;

    this.enCours.set(true);
    this.service.reviser(b.id, { statut, avis: this.avis().trim() }).subscribe({
      next: (res) => {
        this.enCours.set(false);
        this.cible.set(null);
        this.succes.set(res.message ?? '');
        setTimeout(() => this.succes.set(''), 9000);
        this.charger();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'BRIS_DE_GLACE.ERREUR'));
      },
    });
  }

  /**
   * Combien de temps l'accès est resté ouvert. Lu d'un coup d'œil à la
   * relecture : c'est sur ce chiffre qu'on juge si quelqu'un a gardé le
   * dossier plus longtemps que nécessaire.
   *
   * **Un accès encore ouvert ne dure pas quatre heures : il dure depuis qu'il
   * a été ouvert.** La première version prenait l'heure d'expiration dans les
   * deux cas, et affichait « Ouvert 4 h » sur un accès déclaré à l'instant.
   * Vu à l'œil sur une capture, pas par une assertion.
   */
  duree(b: BrisDeGlaceView): string {
    const fin = b.refermeLe
      ? new Date(b.refermeLe)
      : (b.ouvert ? new Date() : new Date(b.expireLe));
    const minutes = Math.max(0, Math.round((fin.getTime() - new Date(b.ouvertLe).getTime()) / 60000));
    const compte = minutes < 60
      ? `${minutes} min`
      : (minutes % 60 === 0 ? `${Math.floor(minutes / 60)} h`
                            : `${Math.floor(minutes / 60)} h ${minutes % 60}`);
    return this.i18n.t(
      b.ouvert ? 'BRIS_DE_GLACE.DUREE_DEPUIS' : 'BRIS_DE_GLACE.DUREE_TOTALE',
      { duree: compte }
    );
  }

  private messageDe(err: unknown, cleDefaut: string): string {
    const e = err as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t(cleDefaut);
  }
}
