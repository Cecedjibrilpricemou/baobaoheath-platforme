// features/asc/stocks/stocks.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AscService } from '../../../core/services/asc.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface Medicament {
  id: string;
  dci: string;
  nomCommercial?: string;
  forme: string;
  dosage: string;
  categorie?: string;
}

// Interface aplatie pour correspondre exactement au template HTML
interface Stock {
  id: string;
  quantite: number;
  seuilAlerte: number;
  unite: string;
  dateExpiration?: string;  // mappé depuis datePeremption du backend
  categorie?: string;       // mappé depuis medicament.categorie du backend
  medicament: Medicament;
}

@Component({
  selector: 'app-stocks',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, InputNumberModule,
    TagModule, ProgressBarModule, SkeletonModule,
    IconFieldModule, InputIconModule,
    TranslatePipe
  ],
  templateUrl: './stocks.component.html',
  styleUrl: './stocks.component.scss'
})
export class StocksComponent implements OnInit {
  private ascService = inject(AscService);
  protected Math = Math;

  stocks           = signal<Stock[]>([]);
  isLoading        = signal(true);
  isSaving         = signal(false);
  successMessage   = signal('');
  errorMessage     = signal('');
  editingId        = signal<string | null>(null);
  editQuantite     = signal(0);
  searchQuery      = signal('');
  totalMedicaments = signal(0);
  stocksCritiques  = signal(0);
  stocksNormaux    = signal(0);

  ngOnInit() { this.loadStocks(); }

  private loadStocks() {
    this.isLoading.set(true);
    this.ascService.getStocks().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const raw = response.data;
          // Aplatir les données pour que le template fonctionne directement
          const data: Stock[] = (raw as Record<string, unknown>[]).map((s) => {
            const med = s['medicament'] as Record<string, unknown> | null | undefined;
            return {
              id: s['id'] as string,
              quantite: s['quantite'] as number,
              seuilAlerte: s['seuilAlerte'] as number,
              unite: s['unite'] as string,
              dateExpiration: (s['datePeremption'] ?? s['dateExpiration']) as string | undefined,
              categorie: (med?.['categorie'] ?? s['categorie']) as string | undefined,
              medicament: (med ?? { dci: (s['medicamentNom'] ?? '—') as string, forme: '', dosage: '' }) as unknown as Stock['medicament']
            };
          });
          this.stocks.set(data);
          this.totalMedicaments.set(data.length);
          this.stocksCritiques.set(data.filter(s => s.quantite <= s.seuilAlerte).length);
          this.stocksNormaux.set(data.filter(s => s.quantite > s.seuilAlerte).length);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  getMedicamentLabel(s: Stock): string {
    const m = s.medicament;
    if (!m) return '—';
    return m.nomCommercial ? `${m.nomCommercial} (${m.dci})` : `${m.dci} ${m.dosage}`;
  }

  get stocksFiltres(): Stock[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.stocks();
    return this.stocks().filter(s => {
      const m = s.medicament;
      return (
        m?.dci?.toLowerCase().includes(q) ||
        m?.nomCommercial?.toLowerCase().includes(q) ||
        s.categorie?.toLowerCase().includes(q)
      );
    });
  }

  getNiveauStock(s: Stock): 'critique' | 'faible' | 'normal' {
    if (s.quantite <= s.seuilAlerte) return 'critique';
    if (s.quantite <= s.seuilAlerte * 2) return 'faible';
    return 'normal';
  }

  getNiveauSeverity(s: Stock): 'danger' | 'warn' | 'success' {
    const n = this.getNiveauStock(s);
    return n === 'critique' ? 'danger' : n === 'faible' ? 'warn' : 'success';
  }

  getStockPourcentage(s: Stock): number {
    return Math.min(Math.round((s.quantite / (s.seuilAlerte * 4)) * 100), 100);
  }

  getBarColor(s: Stock): string {
    const n = this.getNiveauStock(s);
    return n === 'critique' ? '#EF4444' : n === 'faible' ? '#F97316' : '#3EBB70';
  }

  startEdit(s: Stock) { this.editingId.set(s.id); this.editQuantite.set(s.quantite); }
  cancelEdit()        { this.editingId.set(null); this.editQuantite.set(0); }

  saveStock(stockId: string) {
    this.isSaving.set(true); this.errorMessage.set('');
    this.ascService.updateStock(stockId, this.editQuantite()).subscribe({
      next: (response) => {
        this.isSaving.set(false); this.editingId.set(null);
        this.successMessage.set('Stock mis à jour avec succès !');
        setTimeout(() => this.successMessage.set(''), 3000);
        this.loadStocks();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la mise à jour.');
      }
    });
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  isExpireSoon(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  }

  isExpire(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }
}
