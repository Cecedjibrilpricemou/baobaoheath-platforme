// Le dossier réglementaire d'une structure, après sa création.
//
// **La création bloque, mais elle ne couvre pas tout.** Deux besoins réels
// restaient sans écran :
//   - les structures entrées avant cette règle n'ont aucune pièce, et la
//     migration ne pouvait pas les inventer. Leur dossier doit pouvoir se
//     compléter pièce par pièce, sans tout exiger d'un coup ;
//   - **un agrément se renouvelle.** Le ministère prévoit un renouvellement
//     périodique : remplacer la pièce expirée doit être un geste, pas une
//     recréation de la structure.
//
// Partagé par les deux côtés : l'administration nationale pour n'importe
// quelle structure, l'administrateur d'établissement pour la sienne. Le
// périmètre est vérifié par le serveur, jamais ici.
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import type { DossierAgrementView, PieceAgrementView, TypePieceAgrement } from '@baobaoheath/shared-types';

import { AdminService } from '../../../core/services/admin.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { refusLocal, tailleLisible } from '../pieces-agrement/piece-agrement.util';

@Component({
  selector: 'app-dossier-agrement',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, TranslatePipe],
  templateUrl: './dossier-agrement.component.html',
  styleUrl: './dossier-agrement.component.scss',
})
export class DossierAgrementComponent {
  private admin  = inject(AdminService);
  private toastr = inject(ToastrService);
  private i18n   = inject(I18nService);

  readonly idStructure = input.required<string>();

  readonly dossier = signal<DossierAgrementView | null>(null);
  readonly chargement = signal(true);
  /** Le type en cours d'envoi : il désactive sa seule ligne, pas tout l'écran. */
  readonly envoi = signal<string | null>(null);
  readonly libelleAutre = signal('');

  readonly taille = tailleLisible;

  /** Les pièces déjà déposées, rangées par type pour les retrouver par ligne. */
  readonly parType = computed(() => {
    const m = new Map<string, PieceAgrementView>();
    for (const p of this.dossier()?.pieces ?? []) {
      // La liste arrive du plus récent au plus ancien : la première gagne.
      if (!m.has(p.type)) m.set(p.type, p);
    }
    return m;
  });

  /** Les pièces complémentaires, qui peuvent être plusieurs. */
  readonly autres = computed(() =>
    (this.dossier()?.pieces ?? []).filter((p) => p.type === 'AUTRE'));

  /** Les types nommés à montrer : les exigés, plus ceux déjà déposés. */
  readonly lignes = computed<TypePieceAgrement[]>(() => {
    const d = this.dossier();
    if (!d) return [];
    const deposes = d.pieces.filter((p) => p.type !== 'AUTRE').map((p) => p.type);
    return [...new Set<TypePieceAgrement>([...d.manquantes, ...deposes])];
  });

  constructor() {
    // Changer de structure recharge : le composant est monté une fois et
    // réutilisé quand l'administration passe d'une structure à l'autre.
    effect(() => {
      const id = this.idStructure();
      if (id) this.charger(id);
    });
  }

  private charger(id: string) {
    this.chargement.set(true);
    this.admin.dossierStructure(id).subscribe({
      next: (r) => {
        this.chargement.set(false);
        this.dossier.set(r.data ?? null);
      },
      error: (err) => { this.chargement.set(false); this.erreur(err); },
    });
  }

  private erreur(err: unknown) {
    const e = err as { error?: { error?: string; message?: string } };
    this.toastr.error(
      e?.error?.error ?? e?.error?.message ?? this.i18n.t('COMMON.ERROR_GENERIC'),
      this.i18n.t('COMMON.ERROR_TITLE')
    );
  }

  estManquante(type: TypePieceAgrement): boolean {
    return (this.dossier()?.manquantes ?? []).includes(type);
  }

  pieceDe(type: TypePieceAgrement): PieceAgrementView | undefined {
    return this.parType().get(type);
  }

  /**
   * Déposer ou remplacer en un geste : on envoie dès que le fichier est
   * choisi. Un bouton « Enregistrer » séparé n'ajouterait qu'une étape, le
   * dépôt étant déjà unitaire côté serveur.
   */
  deposer(type: TypePieceAgrement, evenement: Event) {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0] ?? null;
    champ.value = '';
    if (!fichier || this.envoi()) return;

    const refuse = refusLocal(fichier);
    if (refuse) { this.toastr.error(this.i18n.t(refuse)); return; }

    // `AUTRE` ne dit rien de lui-même : sans libellé, la pièce est illisible
    // dans la liste, et le serveur la refuse de toute façon.
    const libelle = type === 'AUTRE' ? this.libelleAutre().trim() : '';
    if (type === 'AUTRE' && !libelle) {
      this.toastr.error(this.i18n.t('AGREMENT.DOSSIER.LIBELLE_REQUIS'));
      return;
    }

    this.envoi.set(type);
    this.admin.deposerPieces(
      this.idStructure(),
      { [type]: fichier },
      libelle ? { AUTRE: libelle } : {},
    ).subscribe({
      next: (r) => {
        this.envoi.set(null);
        this.dossier.set(r.data ?? this.dossier());
        if (type === 'AUTRE') this.libelleAutre.set('');
        this.toastr.success(this.i18n.t('AGREMENT.DOSSIER.DEPOSEE'), this.i18n.t('COMMON.SUCCESS'));
      },
      error: (err) => { this.envoi.set(null); this.erreur(err); },
    });
  }

  /**
   * Ouvrir une pièce.
   *
   * Par `getBlob` et non par un lien : le fichier vit dans le stockage privé,
   * derrière une route authentifiée que le serveur journalise. Une URL posée
   * dans un `href` n'emporterait pas forcément le cookie, l'API ne partageant
   * pas toujours l'origine du front.
   */
  voir(piece: PieceAgrementView) {
    this.admin.piece(piece.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        // L'onglet a pris le contenu : on relâche l'objet pour ne pas garder
        // le PDF en mémoire tant que la page vit.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) => this.erreur(err),
    });
  }
}
