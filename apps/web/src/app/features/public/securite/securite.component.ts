// features/public/securite/securite.component.ts
// Page « Securite et donnees » : ce que la plateforme fait reellement pour
// proteger les donnees. Chaque carte correspond a un mecanisme present dans
// le code (chiffrement AES-256-GCM des champs sensibles, hachage bcrypt,
// code a usage unique, sessions qui expirent, roles, consentements, journal
// des acces, file hors ligne). Rien d'annonce qui ne soit construit.
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../shared/services/plateforme.service';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

interface Mesure { cle: string; icone: string; }

const MESURES: Mesure[] = [
  { cle: 'C1', icone: 'pi-lock' },
  { cle: 'C2', icone: 'pi-key' },
  { cle: 'C3', icone: 'pi-shield' },
  { cle: 'C4', icone: 'pi-clock' },
  { cle: 'C5', icone: 'pi-users' },
  { cle: 'C6', icone: 'pi-check-square' },
  { cle: 'C7', icone: 'pi-eye' },
  { cle: 'C8', icone: 'pi-wifi' },
];

@Component({
  selector: 'app-securite',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './securite.component.html',
})
export class SecuriteComponent {
  readonly plateforme = inject(PlateformeService);
  readonly mesures = MESURES;
  readonly params = computed(() => ({ nom: this.plateforme.nom() }));
}
