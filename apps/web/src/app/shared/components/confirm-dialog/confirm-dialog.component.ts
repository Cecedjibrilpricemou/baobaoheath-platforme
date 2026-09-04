// shared/components/confirm-dialog/confirm-dialog.component.ts
// Dialogue de confirmation générique (Material), pensé pour remplacer les
// overlays de confirmation dupliqués dans chaque layout.
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  titre: string;
  texte: string;
  confirmer: string;
  annuler: string;
  /** Classe PrimeIcons, ex: 'pi-sign-out'. */
  icone?: string;
  /** Colore l'action de confirmation en rouge (suppression, déconnexion…). */
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  annuler()  { this.ref.close(false); }
  confirmer() { this.ref.close(true); }
}
