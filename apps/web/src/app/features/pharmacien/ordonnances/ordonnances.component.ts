// features/pharmacien/ordonnances/ordonnances.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';

interface Medicament {
  id: string; dci: string; nomCommercial?: string;
  forme: string; dosage: string; prixUnitaireGnf: number;
}

interface Ordonnance {
  id: string; posologie: string; frequence: string;
  dureeJours: number; quantite: number; statut: string;
  signeLe: string; medecinNom: string;
  medicament: Medicament;
  prixTotalGnf: number;
  alerteAllergie: boolean;
}

interface PatientInfo {
  prenom: string; nom: string;
  dateNaissance: string; groupeSanguin?: string;
  allergiesCritiques: string[];
}

@Component({
  selector: 'app-ordonnances',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, RadioButtonModule, InputNumberModule, SkeletonModule],
  templateUrl: './ordonnances.component.html',
  styleUrl: './ordonnances.component.scss'
})
export class OrdonnancesComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);

  patient          = signal<PatientInfo | null>(null);
  ordonnances      = signal<Ordonnance[]>([]);
  selected         = signal<Ordonnance | null>(null);
  isDelivering     = signal(false);
  isLoading        = signal(false);
  successMessage   = signal('');
  errorMessage     = signal('');

  // Formulaire de délivrance
  modePaiement     = 'ESPECES';
  quantiteDelivree = 0;

  modesPaiement = [
    { label: '💵 Espèces',     value: 'ESPECES'      },
    { label: '🟠 Orange Money', value: 'ORANGE_MONEY' },
    { label: '📱 MTN MoMo',    value: 'MTN_MOMO'     }
  ];

  ngOnInit() {
    // Récupérer les données depuis la navigation (state du router)
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as any;

    if (state?.scanResult) {
      this.patient.set(state.scanResult.patient);
      this.ordonnances.set(state.scanResult.ordonnances);
    } else {
      // Si accès direct sans scan → retourner au scanner
      this.router.navigate(['/pharmacien/scanner']);
    }
  }

  selectionner(o: Ordonnance) {
    this.selected.set(o);
    this.quantiteDelivree = o.quantite;
    this.modePaiement = 'ESPECES';
    this.errorMessage.set('');
  }

  annuler() { this.selected.set(null); this.errorMessage.set(''); }

  delivrer() {
    const o = this.selected();
    if (!o) return;

    this.isDelivering.set(true);
    this.errorMessage.set('');

    this.api.post<any>(`/pharmacien/ordonnances/${o.id}/delivrer`, {
      modePaiement: this.modePaiement,
      quantiteDelivree: this.quantiteDelivree
    }).subscribe({
      next: (response) => {
        this.isDelivering.set(false);
        this.selected.set(null);
        // Supprimer l'ordonnance délivrée de la liste
        this.ordonnances.update(list => list.filter(ord => ord.id !== o.id));
        this.successMessage.set(
          `✅ Médicaments délivrés — ${this.formatMontant(response?.data?.montantGnf ?? 0)}`
        );
        setTimeout(() => this.successMessage.set(''), 5000);
      },
      error: (err) => {
        this.isDelivering.set(false);
        this.errorMessage.set(err?.error?.error ?? 'Erreur lors de la délivrance.');
      }
    });
  }

  getMontantAvecQuantite(o: Ordonnance): number {
    return o.medicament.prixUnitaireGnf * this.quantiteDelivree;
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(m);
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  retourScanner() { this.router.navigate(['/pharmacien/scanner']); }
}
