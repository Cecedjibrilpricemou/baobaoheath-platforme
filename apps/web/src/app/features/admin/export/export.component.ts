// features/admin/export/export.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule],
  templateUrl: './export.component.html',
  styleUrl: './export.component.scss'
})
export class ExportComponent {
  private api = inject(ApiService);

  isExporting  = signal(false);
  successMsg   = signal('');
  errorMsg     = signal('');

  formatOptions = [
    { label: 'JSON', value: 'json' },
    { label: 'CSV',  value: 'csv'  }
  ];

  periodeOptions = [
    { label: '7 derniers jours',  value: '7j'  },
    { label: '30 derniers jours', value: '30j' },
    { label: '3 derniers mois',   value: '3m'  },
    { label: 'Toutes les données',value: 'all' }
  ];

  formatSelectionne  = 'json';
  periodeSelectionnee = '30j';

  exporter() {
    this.isExporting.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    const params = `?format=${this.formatSelectionne}&periode=${this.periodeSelectionnee}`;

    this.api.get<any>(`/analytics/export${params}`).subscribe({
      next: (data) => {
        const content = this.formatSelectionne === 'csv'
          ? data
          : JSON.stringify(data?.data ?? data, null, 2);

        const mimeType = this.formatSelectionne === 'csv' ? 'text/csv' : 'application/json';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `baobaoheath-export-${new Date().toISOString().split('T')[0]}.${this.formatSelectionne}`;
        a.click();
        URL.revokeObjectURL(url);

        this.isExporting.set(false);
        this.successMsg.set('Export téléchargé avec succès !');
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err) => {
        this.isExporting.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de l\'export.');
      }
    });
  }
}
