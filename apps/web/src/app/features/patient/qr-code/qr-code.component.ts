// features/patient/qr-code/qr-code.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../../core/services/auth.service';
import { PatientService } from '../../../core/services/patient.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Patient } from '../../../core/models/patient.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, CardModule, TagModule, SkeletonModule, TranslatePipe],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss'
})
export class QrCodeComponent implements OnInit {
  private authService = inject(AuthService);
  private patientService = inject(PatientService);

  patientInfo  = signal<Patient | null>(null);
  qrCodeUrl    = signal<string | null>(null); // data URL base64 générée côté frontend
  isLoading    = signal(true);
  errorMessage = signal('');

  ngOnInit() { this.loadPatient(); }

  private loadPatient() {
    this.isLoading.set(true);
    this.patientService.getMe().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const info = response.data;
          this.patientInfo.set(info);

          // Générer le QR Code à partir de l'UUID reçu du backend
          if (info.qrCode) {
            this.generateQrCode(info.qrCode);
          } else {
            this.isLoading.set(false);
          }
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Impossible de charger le QR Code.');
        this.isLoading.set(false);
      }
    });
  }

  private async generateQrCode(code: string) {
    try {
      const dataUrl = await QRCode.toDataURL(code, {
        width: 280,
        margin: 2,
        color: { dark: '#0F172A', light: '#ffffff' } // Use slate-900 for dark
      });
      this.qrCodeUrl.set(dataUrl);
    } catch (err) {
      this.errorMessage.set('Impossible de générer le QR Code.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getInitiales(): string {
    const p = this.patientInfo();
    if (!p) return '??';
    return `${p.utilisateur?.prenom?.charAt(0) ?? p.prenom?.charAt(0) ?? ''}${p.utilisateur?.nom?.charAt(0) ?? p.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  downloadQrCode() {
    const url = this.qrCodeUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code-${this.patientInfo()?.utilisateur?.nom ?? this.patientInfo()?.nom ?? 'patient'}.png`;
    a.click();
  }

  shareQrCode() {
    const url = this.qrCodeUrl();
    if (url && navigator.share) {
      navigator.share({ title: 'Mon QR Code BaoBaoHealth', url }).catch(() => {});
    }
  }
}
