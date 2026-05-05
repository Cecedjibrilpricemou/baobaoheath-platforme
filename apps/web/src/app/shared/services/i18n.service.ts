// shared/services/i18n.service.ts
import { Injectable, signal, effect } from '@angular/core';

import FR from '../i18n/fr.json';
import EN from '../i18n/en.json';

export type Lang = 'fr' | 'en';

type NestedRecord = { [key: string]: string | NestedRecord };

@Injectable({ providedIn: 'root' }) // ← CORRECTION
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
      document.documentElement.setAttribute('lang', this.lang());
    });
  }

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

    if (params) {
      return val.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p) =>
        String(params[p] ?? `{{${p}}}`)
      );
    }

    return val;
  }

  toggle(): void { this.lang.update(l => (l === 'fr' ? 'en' : 'fr')); }
  setLang(lang: Lang): void { this.lang.set(lang); }
}