// shared/services/theme.service.ts
// Gestion Clair / Sombre via signal + effect Angular
// Persiste le choix dans localStorage
// PrimeNG suit grâce à darkModeSelector: '[data-theme="dark"]' dans app.config.ts

import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal<boolean>(
    localStorage.getItem('bb-theme') === 'dark'
  );

  constructor() {
    // Applique immédiatement le thème stocké
    this.applyTheme(this.isDark());

    // Réagit à chaque changement du signal
    effect(() => {
      const dark = this.isDark();
      this.applyTheme(dark);
      localStorage.setItem('bb-theme', dark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  setDark(): void  { this.isDark.set(true); }
  setLight(): void { this.isDark.set(false); }

  private applyTheme(dark: boolean): void {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
