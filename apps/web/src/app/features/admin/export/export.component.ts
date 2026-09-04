// features/admin/export/export.component.ts
import { Component, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [
    MatFormFieldModule, MatSelectModule,CommonModule, FormsModule, TranslatePipe],
  templateUrl: './export.component.html',
  styleUrl: './export.component.scss'
})
export class ExportComponent {
  private adminService = inject(AdminService);
  private i18n = inject(I18nService);

  isExporting  = signal(false);
  successMsg   = signal('');
  errorMsg     = signal('');

  formatOptions = [
    { label: 'JSON', value: 'json' },
    { label: 'CSV',  value: 'csv'  }
  ];

  get periodeOptions() {
    return [
      { label: this.i18n.t('ADMIN.EXPORT.PERIODE_7J'), value: '7j' },
      { label: this.i18n.t('ADMIN.EXPORT.PERIODE_30J'), value: '30j' },
      { label: this.i18n.t('ADMIN.EXPORT.PERIODE_3M'), value: '3m' },
      { label: this.i18n.t('ADMIN.EXPORT.PERIODE_ALL'), value: 'all' }
    ];
  }

  formatSelectionne  = 'json';
  periodeSelectionnee = '30j';

  exporter() {
    this.isExporting.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    this.adminService.exportAnalytics(this.formatSelectionne, this.periodeSelectionnee).subscribe({
      next: (response) => {
        const raw = response as { data?: unknown };
        const content = this.formatSelectionne === 'csv'
          ? String(response)
          : JSON.stringify(raw?.data ?? response, null, 2);

        const mimeType = this.formatSelectionne === 'csv' ? 'text/csv' : 'application/json';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `baobaoheath-export-${new Date().toISOString().split('T')[0]}.${this.formatSelectionne}`;
        a.click();
        URL.revokeObjectURL(url);

        this.isExporting.set(false);
        this.successMsg.set(this.i18n.t('ADMIN.EXPORT.SUCCESS_EXPORT'));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err) => {
        this.isExporting.set(false);
        this.errorMsg.set(err?.error?.message ?? err?.error?.error ?? this.i18n.t('ADMIN.EXPORT.ERR_EXPORT'));
      }
    });
  }
}
