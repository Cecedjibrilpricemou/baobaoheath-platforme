import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../shared/services/plateforme.service';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

interface FaqGroup {
  cle: string;
  questions: readonly string[];
}

const GROUPES_FAQ: readonly FaqGroup[] = [
  { cle: 'PLATFORM', questions: ['Q1', 'Q2'] },
  { cle: 'ACCOUNT', questions: ['Q1', 'Q2'] },
  { cle: 'CARE', questions: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { cle: 'PROS', questions: ['Q1'] },
  { cle: 'DATA', questions: ['Q1', 'Q2'] },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './faq.component.html',
})
export class FaqComponent {
  readonly plateforme = inject(PlateformeService);
  readonly groupes = GROUPES_FAQ;
  readonly params = computed(() => ({ nom: this.plateforme.nom() }));
}
