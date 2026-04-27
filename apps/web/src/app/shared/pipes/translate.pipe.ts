// shared/pipes/translate.pipe.ts
// Pipe standalone — même syntaxe que @ngx-translate : {{ 'KEY' | translate }}
// pure: false → se rafraîchit quand la langue change (signal réactif)

import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { I18nService } from '../services/i18n.service';
import { effect } from '@angular/core';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false   // impure pour réagir aux changements de langue
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  private cdr  = inject(ChangeDetectorRef);

  constructor() {
    // Déclenche la détection de changement quand la langue change
    effect(() => {
      this.i18n.lang(); // lecture du signal = abonnement
      this.cdr.markForCheck();
    });
  }

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
