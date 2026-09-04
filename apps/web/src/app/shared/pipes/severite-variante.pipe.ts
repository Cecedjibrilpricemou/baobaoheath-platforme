// shared/pipes/severite-variante.pipe.ts
// Traduit une severite PrimeNG ('success' | 'info' | 'warn' | 'danger' |
// 'secondary') vers la variante correspondante du badge maison .bb-badge.
//
// Permet de migrer les <p-tag> vers des badges sans toucher aux methodes
// getXxxSeverity() deja presentes dans les composants.
import { Pipe, PipeTransform } from '@angular/core';

const VARIANTES: Record<string, string> = {
  success: 'success',
  info: 'info',
  warn: 'warning',
  warning: 'warning',
  danger: 'danger',
  error: 'danger',
  secondary: 'neutral',
  contrast: 'neutral',
};

@Pipe({ name: 'severiteVariante', standalone: true })
export class SeveriteVariantePipe implements PipeTransform {
  transform(severite: string | null | undefined): string {
    return VARIANTES[severite ?? ''] ?? 'neutral';
  }
}
