// features/pharmacien/stocks/stocks.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PharmacienService } from '../../../core/services/pharmacien.service';

interface Medicament {
  id: string; dci: string; nomCommercial?: string;
  forme: string; dosage: string; categorie?: string; prixUnitaireGnf: number;
}

interface Stock {
  id: string; quantite: number; seuilAlerte: number;
  unite: string; datePeremption?: string; margeGnf: number;
  medicament: Medicament;
}

@Component({
  selector: 'app-pharmacien-stocks',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, SkeletonModule,
    InputTextModule, InputNumberModule, SelectModule, IconFieldModule, InputIconModule],
  templateUrl: './stocks.component.html',
  styleUrl: './stocks.component.scss'
})
export class PharmacienStocksComponent implements OnInit {
  private pharmacienService = inject(PharmacienService);
  protected Math = Math;

  stocks           = signal<Stock[]>([]);
  medicaments      = signal<Medicament[]>([]);
  isLoading        = signal(true);
  isSaving         = signal(false);
  searchQuery      = signal('');
  totalMedicaments = signal(0);
  stocksCritiques  = signal(0);
  stocksNormaux    = signal(0);
  showForm         = signal(false);
  successMsg       = signal('');
  errorMsg         = signal('');

  // Formulaire réapprovisionnement
  formReappro = {
    idMedicament: '',
    quantiteAjoutee: null as number | null,
    datePeremption: '',
    margeGnf: null as number | null
  };

  ngOnInit() { this.loadStocks(); this.loadMedicaments(); }

  private loadStocks() {
    this.isLoading.set(true);
    this.pharmacienService.getStocks().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as unknown as Stock[];
          this.stocks.set(data);
          this.totalMedicaments.set(data.length);
          this.stocksCritiques.set(data.filter((s: Stock) => s.quantite <= s.seuilAlerte).length);
          this.stocksNormaux.set(data.filter((s: Stock) => s.quantite > s.seuilAlerte).length);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  private loadMedicaments() {
    this.pharmacienService.getMedicaments().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.medicaments.set(response.data as unknown as Medicament[]);
        }
      },
      error: () => {}
    });
  }

  get medicamentOptions() {
    return this.medicaments().map(m => ({
      label: m.nomCommercial ? `${m.nomCommercial} (${m.dci}) — ${m.dosage}` : `${m.dci} — ${m.dosage}`,
      value: m.id
    }));
  }

  get stocksFiltres(): Stock[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.stocks();
    return this.stocks().filter(s =>
      s.medicament.dci?.toLowerCase().includes(q) ||
      s.medicament.nomCommercial?.toLowerCase().includes(q) ||
      s.medicament.categorie?.toLowerCase().includes(q)
    );
  }

  reapprovisionner() {
    if (!this.formReappro.idMedicament || !this.formReappro.quantiteAjoutee) {
      this.errorMsg.set('Médicament et quantité sont obligatoires.'); return;
    }
    this.isSaving.set(true); this.errorMsg.set('');

    const payload = {
      idMedicament: this.formReappro.idMedicament,
      quantiteAjoutee: this.formReappro.quantiteAjoutee,
      datePeremption: this.formReappro.datePeremption || undefined,
      margeGnf: this.formReappro.margeGnf ?? undefined
    };

    this.pharmacienService.reapprovisionner(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showForm.set(false);
        this.formReappro = { idMedicament: '', quantiteAjoutee: null, datePeremption: '', margeGnf: null };
        this.successMsg.set('Stock réapprovisionné avec succès !');
        setTimeout(() => this.successMsg.set(''), 4000);
        this.loadStocks();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.error ?? 'Erreur lors du réapprovisionnement.');
      }
    });
  }

  getMedicamentLabel(s: Stock): string {
    return s.medicament.nomCommercial
      ? `${s.medicament.nomCommercial} (${s.medicament.dci})`
      : `${s.medicament.dci} ${s.medicament.dosage}`;
  }

  getPrixVente(s: Stock): number { return s.medicament.prixUnitaireGnf + (s.margeGnf ?? 0); }

  getNiveauSeverity(s: Stock): 'danger' | 'warn' | 'success' {
    if (s.quantite <= s.seuilAlerte) return 'danger';
    if (s.quantite <= s.seuilAlerte * 2) return 'warn';
    return 'success';
  }

  getNiveauLabel(s: Stock): string {
    if (s.quantite <= s.seuilAlerte) return 'Critique';
    if (s.quantite <= s.seuilAlerte * 2) return 'Faible';
    return 'Normal';
  }

  getBarWidth(s: Stock): number { return Math.min(Math.round((s.quantite / (s.seuilAlerte * 4)) * 100), 100); }
  getBarColor(s: Stock): string {
    if (s.quantite <= s.seuilAlerte) return '#EF4444';
    if (s.quantite <= s.seuilAlerte * 2) return '#F97316';
    return '#3EBB70';
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(m);
  }

  isExpireSoon(s: Stock): boolean {
    if (!s.datePeremption) return false;
    return new Date(s.datePeremption).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  }
}
