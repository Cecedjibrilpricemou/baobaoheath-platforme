// features/patient/qr-code/qr-code.component.ts
// CORRIGÉ : génération du QR Code via la librairie "qrcode"
// qrCode backend = UUID (ex: clxyz123...) → généré en data URL base64 ici
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import QRCode from 'qrcode';

interface PatientInfo {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  dateNaissance?: string;
  groupeSanguin?: string;
  qrCode?: string; // UUID reçu du backend
  utilisateur?: { nom: string; prenom: string; telephone: string; };
}

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, CardModule, TagModule, SkeletonModule, TranslatePipe],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss'
})
export class QrCodeComponent implements OnInit {
  private api         = inject(ApiService);
  private authService = inject(AuthService);

  patientInfo  = signal<PatientInfo | null>(null);
  qrCodeUrl    = signal<string | null>(null); // data URL base64 générée côté frontend
  isLoading    = signal(true);
  errorMessage = signal('');

  ngOnInit() { this.loadPatient(); }

  private loadPatient() {
    this.isLoading.set(true);
    this.api.get<any>('/patients/me').subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        const info: PatientInfo = {
          id: data?.id ?? '',
          nom: data?.utilisateur?.nom ?? data?.nom ?? '',
          prenom: data?.utilisateur?.prenom ?? data?.prenom ?? '',
          telephone: data?.utilisateur?.telephone ?? data?.telephone ?? '',
          dateNaissance: data?.dateNaissance,
          groupeSanguin: data?.groupeSanguin,
          qrCode: data?.qrCode,
          utilisateur: data?.utilisateur
        };
        this.patientInfo.set(info);

        // Générer le QR Code à partir de l'UUID reçu du backend
        if (info.qrCode) {
          this.generateQrCode(info.qrCode);
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
      // Génère une data URL PNG du QR Code à partir du code UUID
      const dataUrl = await QRCode.toDataURL(code, {
        width: 280,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' }
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
    return `${p.prenom?.charAt(0) ?? ''}${p.nom?.charAt(0) ?? ''}`.toUpperCase();
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
    a.download = `qr-code-${this.patientInfo()?.nom ?? 'patient'}.png`;
    a.click();
  }

  shareQrCode() {
    const url = this.qrCodeUrl();
    if (url && navigator.share) {
      navigator.share({ title: 'Mon QR Code BaoBaoHealth', url }).catch(() => {});
    }
  }
}
