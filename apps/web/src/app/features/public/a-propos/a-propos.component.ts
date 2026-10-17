// features/public/a-propos/a-propos.component.ts
// Page « A propos » : le constat, la mission, les valeurs. Volontairement
// sans equipe, partenaires ni chiffres : rien n'est affiche qui ne soit
// fourni par le porteur du projet (regle « rien de trompeur sur la vitrine »).
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../shared/services/plateforme.service';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

interface Valeur { cle: string; icone: string; }

const VALEURS: Valeur[] = [
  { cle: 'V1', icone: 'pi-map-marker' },
  { cle: 'V2', icone: 'pi-lock' },
  { cle: 'V3', icone: 'pi-share-alt' },
  { cle: 'V4', icone: 'pi-globe' },
];

@Component({
  selector: 'app-a-propos',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './a-propos.component.html',
})
export class AProposComponent {
  private plateforme = inject(PlateformeService);
  readonly valeurs = VALEURS;
  readonly params = computed(() => ({ nom: this.plateforme.nom() }));
}
