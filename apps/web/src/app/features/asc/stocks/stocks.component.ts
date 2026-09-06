// features/asc/stocks/stocks.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AscService } from '../../../core/services/asc.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import type { HorodatageApi, StockAscView } from '@baobaoheath/shared-types';

@Component({
  selector: 'app-stocks',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    TranslatePipe
  ],
  templateUrl: './stocks.component.html',
  styleUrl: './stocks.component.scss'
})
export class StocksComponent implements OnInit {
  private ascService = inject(AscService);
  private i18n = inject(I18nService);
  protected Math = Math;

  stocks           = signal<StockAscView[]>([]);
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
          // GET /asc/stocks renvoie deja la ligne avec son medicament :
          // aucun remappage necessaire (cf. StockAscView).
          const data = response.data as unknown as StockAscView[];
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

  getMedicamentLabel(s: StockAscView): string {
    const m = s.medicament;
    if (!m) return '—';
    return m.nomCommercial ? `${m.nomCommercial} (${m.dci})` : `${m.dci} ${m.dosage}`;
  }

  get stocksFiltres(): StockAscView[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.stocks();
    return this.stocks().filter(s => {
      const m = s.medicament;
      return (
        m?.dci?.toLowerCase().includes(q) ||
        m?.nomCommercial?.toLowerCase().includes(q) ||
        s.medicament.categorie?.toLowerCase().includes(q)
      );
    });
  }

  getNiveauStock(s: StockAscView): 'critique' | 'faible' | 'normal' {
    if (s.quantite <= s.seuilAlerte) return 'critique';
    if (s.quantite <= s.seuilAlerte * 2) return 'faible';
    return 'normal';
  }

  getStockPourcentage(s: StockAscView): number {
    return Math.min(Math.round((s.quantite / (s.seuilAlerte * 4)) * 100), 100);
  }

  /** Variante de badge correspondant au niveau de stock. */
  getNiveauVariante(s: StockAscView): string {
    const n = this.getNiveauStock(s);
    return n === 'critique' ? 'danger' : n === 'faible' ? 'warning' : 'success';
  }

  getBarColor(s: StockAscView): string {
    const n = this.getNiveauStock(s);
    return n === 'critique' ? '#EF4444' : n === 'faible' ? '#F97316' : '#3EBB70';
  }

  startEdit(s: StockAscView) { this.editingId.set(s.id); this.editQuantite.set(s.quantite); }
  cancelEdit()        { this.editingId.set(null); this.editQuantite.set(0); }

  saveStock(stockId: string) {
    this.isSaving.set(true); this.errorMessage.set('');
    const stock = this.stocks().find(s => s.id === stockId);
    const libelle = stock
      ? `${stock.medicament.nomCommercial || stock.medicament.dci} — ${this.editQuantite()} ${stock.unite}`
      : undefined;

    const nouvelleQuantite = this.editQuantite();

    this.ascService.updateStock(stockId, nouvelleQuantite, libelle).subscribe({
      next: (resultat) => {
        this.isSaving.set(false); this.editingId.set(null);
        this.successMessage.set(this.i18n.t(
          resultat.synchronise ? 'ASC.STOCKS.SUCCESS_UPDATE' : 'ASC.STOCKS.SUCCESS_QUEUED'
        ));
        setTimeout(() => this.successMessage.set(''), resultat.synchronise ? 3000 : 5000);

        if (resultat.synchronise) {
          this.loadStocks();
          return;
        }
        // Hors connexion : le rechargement échouerait et réafficherait
        // l'ancienne quantité, laissant croire à l'agent que sa saisie est
        // perdue. On applique donc la valeur localement en attendant l'envoi.
        this.appliquerQuantiteLocale(stockId, nouvelleQuantite);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.error ?? err?.error?.message ?? this.i18n.t('ASC.STOCKS.ERR_UPDATE'));
      }
    });
  }

  private appliquerQuantiteLocale(stockId: string, quantite: number) {
    this.stocks.update(liste =>
      liste.map(s => (s.id === stockId ? { ...s, quantite } : s))
    );
    const liste = this.stocks();
    this.stocksCritiques.set(liste.filter(s => s.quantite <= s.seuilAlerte).length);
    this.stocksNormaux.set(liste.filter(s => s.quantite > s.seuilAlerte).length);
  }

  formatDate(d?: HorodatageApi | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  isExpireSoon(dateStr?: HorodatageApi | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  }

  isExpire(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }
}
