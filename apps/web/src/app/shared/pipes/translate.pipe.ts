// shared/pipes/translate.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../services/i18n.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Lecture du signal lang() → Angular re-exécute le pipe quand la langue change
    this.i18n.lang();
    return this.i18n.t(key, params);
  }
}