// features/public/legal/legal.component.ts
// Pages legales : politique de confidentialite et conditions d'utilisation.
// Un seul composant, le document est choisi par la route (data.doc). Le
// texte vit dans les traductions (PUBLIC.PRIVACY.*, PUBLIC.TERMS.*) ; ici,
// seulement la structure : sections, paragraphes, listes.
//
// Ces textes sont des projets : un bandeau « version provisoire » reste
// affiche tant qu'un juriste ne les a pas valides (BANDEAU_PROVISOIRE).
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../shared/services/plateforme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

/** A passer a false une fois les textes valides juridiquement. */
const BANDEAU_PROVISOIRE = true;

type Document = 'PRIVACY' | 'TERMS';

interface Section {
  /** Cle de la section (S1, S2…) : sert aussi d'ancre. */
  id: string;
  /** Paragraphes avant la liste. */
  avant: string[];
  /** Puces (facultatives). */
  liste?: string[];
  /** Paragraphes apres la liste. */
  apres?: string[];
  /** Section mise en avant (avertissement). */
  important?: boolean;
}

const SECTIONS: Record<Document, Section[]> = {
  PRIVACY: [
    { id: 'S1', avant: ['P1'] },
    { id: 'S2', avant: ['P1'], liste: ['L1', 'L2', 'L3'] },
    { id: 'S3', avant: ['P1'], liste: ['L1', 'L2', 'L3'], apres: ['P2'] },
    { id: 'S4', avant: ['P1'] },
    { id: 'S5', avant: ['P1'] },
    { id: 'S6', avant: ['P1'] },
    { id: 'S7', avant: ['P1'], liste: ['L1', 'L2', 'L3', 'L4'], apres: ['P2'] },
    { id: 'S8', avant: ['P1'] },
  ],
  TERMS: [
    { id: 'S1', avant: ['P1'] },
    { id: 'S2', avant: ['P1'], important: true },
    { id: 'S3', avant: ['P1'], liste: ['L1', 'L2', 'L3'] },
    { id: 'S4', avant: ['P1'] },
    { id: 'S5', avant: ['P1'] },
    { id: 'S6', avant: ['P1'] },
    { id: 'S7', avant: ['P1'] },
    { id: 'S8', avant: ['P1'] },
  ],
};

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './legal.component.html',
})
export class LegalComponent {
  private route = inject(ActivatedRoute);
  private plateforme = inject(PlateformeService);
  private i18n = inject(I18nService);

  readonly doc: Document = this.route.snapshot.data['doc'] === 'TERMS' ? 'TERMS' : 'PRIVACY';
  readonly sections = SECTIONS[this.doc];
  readonly provisoire = BANDEAU_PROVISOIRE;

  /** Prefixe des cles de traduction du document. */
  readonly cle = `PUBLIC.${this.doc}`;

  /** Nom de la plateforme et adresse de contact (parametres), injectes dans les textes. */
  readonly params = computed(() => {
    this.i18n.lang();
    return {
      nom: this.plateforme.nom(),
      contact: this.plateforme.emailContact() || this.i18n.t('PUBLIC.CONTACT_FALLBACK'),
    };
  });

  /** Sommaire : defilement doux vers la section (pas d'ancre dans l'URL). */
  allerA(id: string) {
    document.getElementById('legal-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
