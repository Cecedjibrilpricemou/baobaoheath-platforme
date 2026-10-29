// Les pièces d'agrément à joindre, selon le type de structure.
//
// **La création n'exigeait aucune preuve réglementaire.** Une pharmacie sans
// agrément, une clinique sans autorisation d'exploitation entraient sur la
// plateforme comme les autres. Depuis le 2026-10-28, le dossier bloque.
//
// Partagé par les deux écrans qui créent — les structures côté administration
// nationale, les pharmacies côté établissement. Les dupliquer aurait fait
// diverger la liste des pièces exigées.
//
// Les contrôles faits ici **ne remplacent pas ceux du serveur**, qui lit les
// octets de tête de chaque fichier. Ils existent pour une raison pratique :
// sur un réseau guinéen, découvrir après dix minutes d'envoi qu'un fichier
// était trop gros ou n'était pas un PDF se paie en temps perdu.
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { TypePieceAgrement } from '@baobaoheath/shared-types';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** 5 Mo, comme le serveur : un agrément scanné à plat dépasse souvent 2 Mo. */
const TAILLE_MAX = 5 * 1024 * 1024;

/**
 * Ce que chaque type doit produire. **Copie assumée de la table du serveur**,
 * qui reste seul juge : l'écran ne peut pas deviner une règle qu'il
 * n'appliquerait qu'à moitié, mais il doit savoir quoi demander avant
 * d'envoyer quoi que ce soit.
 */
const PIECES_PAR_TYPE: Readonly<Record<string, readonly TypePieceAgrement[]>> = {
  PHARMACIE: ['AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE'],
  CLINIQUE: ['AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE'],
  LABORATOIRE: ['AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE'],
  ASSURANCE: ['AGREMENT_ASSURANCE'],
};

@Component({
  selector: 'app-pieces-agrement',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslatePipe],
  templateUrl: './pieces-agrement.component.html',
  styleUrl: './pieces-agrement.component.scss',
})
export class PiecesAgrementComponent {
  /** Le type de structure en cours de création. */
  readonly type = input.required<string>();

  /**
   * Vrai quand la structure opère sous l'autorisation d'une autre — une
   * pharmacie hospitalière. Elle n'a pas d'agrément propre à produire.
   */
  readonly sousAutoriteDuParent = input(false);

  readonly pieces = output<Partial<Record<TypePieceAgrement, File>>>();
  /** Le parent désactive son bouton d'envoi tant que c'est faux. */
  readonly complet = output<boolean>();

  readonly choisies = signal<Partial<Record<TypePieceAgrement, File>>>({});
  readonly refus = signal<Partial<Record<TypePieceAgrement, string>>>({});

  readonly requises = computed<readonly TypePieceAgrement[]>(() =>
    this.sousAutoriteDuParent() ? [] : (PIECES_PAR_TYPE[this.type()] ?? []),
  );

  readonly exigeDesPieces = computed(() => this.requises().length > 0);

  readonly manquantes = computed(() => {
    const prises = this.choisies();
    return this.requises().filter((p) => !prises[p]);
  });

  constructor() {
    // Changer de type change la liste des pièces exigées : les fichiers déjà
    // choisis pour un autre type ne doivent pas rester. Sans cette remise à
    // zéro, on enverrait le diplôme saisi pour une clinique avec un poste de
    // santé, qui n'en demande aucun.
    effect(() => {
      this.type();
      this.sousAutoriteDuParent();
      this.choisies.set({});
      this.refus.set({});
      this.pieces.emit({});
      this.complet.emit(this.requises().length === 0);
    });
  }

  /** Le nom du fichier retenu, pour l'afficher à la place du champ vide. */
  nomDe(piece: TypePieceAgrement): string | null {
    return this.choisies()[piece]?.name ?? null;
  }

  tailleDe(piece: TypePieceAgrement): string {
    const octets = this.choisies()[piece]?.size ?? 0;
    return octets >= 1024 * 1024
      ? `${(octets / (1024 * 1024)).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(octets / 1024))} Ko`;
  }

  refusDe(piece: TypePieceAgrement): string | null {
    return this.refus()[piece] ?? null;
  }

  choisir(piece: TypePieceAgrement, evenement: Event) {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0] ?? null;
    this.refus.update((r) => ({ ...r, [piece]: undefined }));

    if (!fichier) {
      this.retirer(piece);
      return;
    }

    // Deux refus avant l'envoi, pour ne pas faire monter 20 Mo inutilement.
    // Le serveur, lui, lit les octets de tête : c'est lui qui fait foi.
    if (fichier.size > TAILLE_MAX) {
      champ.value = '';
      this.refus.update((r) => ({ ...r, [piece]: 'AGREMENT.PIECE.TROP_GROS' }));
      this.retirer(piece);
      return;
    }
    const nomPdf = fichier.name.toLowerCase().endsWith('.pdf');
    if (fichier.type !== 'application/pdf' && !nomPdf) {
      champ.value = '';
      this.refus.update((r) => ({ ...r, [piece]: 'AGREMENT.PIECE.PAS_UN_PDF' }));
      this.retirer(piece);
      return;
    }

    this.choisies.update((c) => ({ ...c, [piece]: fichier }));
    this.emettre();
  }

  retirer(piece: TypePieceAgrement) {
    this.choisies.update((c) => {
      const copie = { ...c };
      delete copie[piece];
      return copie;
    });
    this.emettre();
  }

  private emettre() {
    this.pieces.emit(this.choisies());
    this.complet.emit(this.manquantes().length === 0);
  }
}
