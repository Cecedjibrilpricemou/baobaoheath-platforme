// features/pharmacien/scanner/scanner.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
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

interface ScanResult {
  patient: PatientInfo;
  ordonnances: Ordonnance[];
  totalOrdonnances: number;
}

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TagModule, CardModule],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss'
})
export class ScannerComponent {
  private pharmacienService = inject(PharmacienService);
  private router = inject(Router);

  qrCode       = '';
  isScanning   = signal(false);
  errorMessage = signal('');
  scanResult   = signal<ScanResult | null>(null);

  scan() {
    if (!this.qrCode.trim()) {
      this.errorMessage.set('Veuillez saisir un QR Code.');
      return;
    }
    this.isScanning.set(true);
    this.errorMessage.set('');
    this.scanResult.set(null);

    this.pharmacienService.scanQrCode(this.qrCode.trim()).subscribe({
      next: (response) => {
        this.isScanning.set(false);
        if (response.success && response.data) {
          this.scanResult.set(response.data as unknown as ScanResult);
        } else {
          this.scanResult.set(response.data as unknown as ScanResult ?? null);
        }
      },
      error: (err) => {
        this.isScanning.set(false);
        this.errorMessage.set(err?.error?.error ?? err?.error?.message ?? 'Patient non trouvé — QR Code invalide');
      }
    });
  }

  voirOrdonnances() {
    this.router.navigate(['/pharmacien/ordonnances'], {
      state: { scanResult: this.scanResult(), qrCode: this.qrCode }
    });
  }

  reset() { this.qrCode = ''; this.scanResult.set(null); this.errorMessage.set(''); }

  getAge(dateNaissance: string): number {
    return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(m);
  }

  getTotalOrdonnances(): number {
    return this.scanResult()?.ordonnances.reduce((acc, o) => acc + o.prixTotalGnf, 0) ?? 0;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.scan();
  }
}
