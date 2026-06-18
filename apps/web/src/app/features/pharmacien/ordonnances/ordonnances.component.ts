import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { PharmacienService } from '../../../core/services/pharmacien.service';

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
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, RadioButtonModule, InputNumberModule, SkeletonModule, InputTextModule],
  templateUrl: './ordonnances.component.html',
  styleUrl: './ordonnances.component.scss'
})
export class OrdonnancesComponent implements OnInit {
  private pharmacienService = inject(PharmacienService);
  private router = inject(Router);

  // Scanner State
  qrCode       = '';
  isScanning   = signal(false);
  errorMessage = signal('');

  // Patient & Ordonnances State
  patient          = signal<PatientInfo | null>(null);
  ordonnances      = signal<Ordonnance[]>([]);
  selected         = signal<Ordonnance | null>(null);
  isDelivering     = signal(false);
  successMessage   = signal('');

  // Formulaire de délivrance
  modePaiement     = 'ESPECES';
  quantiteDelivree = 0;

  modesPaiement = [
    { label: '💵 Espèces',     value: 'ESPECES'      },
    { label: '🟠 Orange Money', value: 'ORANGE_MONEY' },
    { label: '📱 MTN MoMo',    value: 'MTN_MOMO'     }
  ];

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { scanResult?: { patient?: PatientInfo; ordonnances?: Ordonnance[] } } | undefined;

    if (state?.scanResult) {
      this.patient.set(state.scanResult.patient ?? null);
      this.ordonnances.set(state.scanResult.ordonnances ?? []);
    }
    // FINI LE BUG : Aucune redirection si aucun scanResult n'est présent !
    // L'interface affichera d'elle-même le composant Scanner (Empty State).
  }

  scan() {
    if (!this.qrCode.trim()) {
      this.errorMessage.set('Veuillez saisir un QR Code.');
      return;
    }
    this.isScanning.set(true);
    this.errorMessage.set('');
    this.patient.set(null);
    this.ordonnances.set([]);

    this.pharmacienService.scanQrCode(this.qrCode.trim()).subscribe({
      next: (response) => {
        this.isScanning.set(false);
        const raw = response.data as unknown as { patient?: PatientInfo; ordonnances?: Ordonnance[] } | null;
        this.patient.set(raw?.patient ?? null);
        this.ordonnances.set(raw?.ordonnances ?? []);
      },
      error: (err) => {
        this.isScanning.set(false);
        this.errorMessage.set(err?.error?.error ?? err?.error?.message ?? 'Patient non trouvé — QR Code invalide');
      }
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.scan();
  }

  resetScan() {
    this.patient.set(null);
    this.ordonnances.set([]);
    this.qrCode = '';
    this.errorMessage.set('');
    this.successMessage.set('');
    this.selected.set(null);
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

    this.pharmacienService.delivrerOrdonnance(o.id, {
      modePaiement: this.modePaiement,
      quantiteDelivree: this.quantiteDelivree
    } as unknown as import('../../../core/models/pharmacien.model').DelivrancePayload).subscribe({
      next: (response) => {
        this.isDelivering.set(false);
        this.selected.set(null);
        this.ordonnances.update(list => list.filter(ord => ord.id !== o.id));
        const responseData = response?.data as unknown as { montantGnf?: number };
        this.successMessage.set(`✅ Médicaments délivrés — ${this.formatMontant(responseData?.montantGnf ?? 0)}`);
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
}
