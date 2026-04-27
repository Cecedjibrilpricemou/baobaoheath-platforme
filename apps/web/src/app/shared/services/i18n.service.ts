// shared/services/i18n.service.ts
// Service de traduction custom (même API que @ngx-translate)
// Utilisation : inject(I18nService).t('AUTH.LOGIN.TITLE')
// Dans les templates : {{ 'AUTH.LOGIN.TITLE' | translate }}

import { Injectable, signal, effect } from '@angular/core';

// Import statique des fichiers JSON de traduction
import FR from '../i18n/fr.json';
import EN from '../i18n/en.json';

export type Lang = 'fr' | 'en';

type NestedRecord = { [key: string]: string | NestedRecord };

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(
    (localStorage.getItem('bb-lang') as Lang) ?? 'fr'
  );

  private readonly translations: Record<Lang, NestedRecord> = {
    fr: FR as NestedRecord,
    en: EN as NestedRecord
  };

  constructor() {
    effect(() => {
      localStorage.setItem('bb-lang', this.lang());
      // Force la mise à jour des pipes purs si besoin
      document.documentElement.setAttribute('lang', this.lang());
    });
  }

  /** Traduit une clé pointée (ex: 'AUTH.LOGIN.TITLE') */
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let val: NestedRecord | string = this.translations[this.lang()];

    for (const k of keys) {
      if (typeof val === 'object' && val !== null) {
        val = val[k];
      } else {
        break;
      }
    }

    if (typeof val !== 'string') return key;

    // Interpolation simple : {{ param }}
    if (params) {
      return val.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p) =>
        String(params[p] ?? `{{${p}}}`)
      );
    }

    return val;
  }

  toggle(): void {
    this.lang.update(l => (l === 'fr' ? 'en' : 'fr'));
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
  }
}
