// features/public/professionnels/professionnels.component.ts
// Page « Professionnels de sante » : les six espaces metier, tels qu'ils
// existent dans l'application (routes asc, medecin, pharmacien, laboratoire,
// hopital, admin-structure), et la facon de rejoindre la plateforme.
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../shared/services/plateforme.service';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

interface Espace { cle: string; icone: string; }

const ESPACES: Espace[] = [
  { cle: 'ASC',     icone: 'pi-heart' },
  { cle: 'MED',     icone: 'pi-user' },
  { cle: 'PHARMA',  icone: 'pi-shopping-bag' },
  { cle: 'LABO',    icone: 'pi-filter' },
  { cle: 'HOPITAL', icone: 'pi-building' },
  { cle: 'ADMIN',   icone: 'pi-sitemap' },
];

/** Etapes pour rejoindre la plateforme. */
const ETAPES = ['E1', 'E2', 'E3'];

@Component({
  selector: 'app-professionnels',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './professionnels.component.html',
})
export class ProfessionnelsComponent {
  readonly plateforme = inject(PlateformeService);
  readonly espaces = ESPACES;
  readonly etapes = ETAPES;
  readonly params = computed(() => ({ nom: this.plateforme.nom() }));
}
