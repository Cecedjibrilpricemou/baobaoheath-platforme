// features/patient/qr-code/qr-code.component.ts

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface PatientInfo {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  qrCode: string;
  dateNaissance?: string;
  groupeSanguin?: string;
}

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss'
})
export class QrCodeComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  patientInfo = signal<PatientInfo | null>(null);
  qrCodeUrl = signal<string>('');
  isLoading = signal(true);
  errorMessage = signal('');

  ngOnInit() {
    this.loadPatientInfo();
  }

  private loadPatientInfo() {
    this.isLoading.set(true);
    this.api.get<any>('/patients/me').subscribe({
      next: (response) => {
        // Parse le format backend { success, data } ou direct
        const data = response?.data ?? response;

        const info: PatientInfo = {
          id: data?.id ?? '',
          // Fusionne utilisateur + patientProfile
          nom: data?.utilisateur?.nom ?? data?.nom ?? this.currentUser()?.nom ?? '',
          prenom: data?.utilisateur?.prenom ?? data?.prenom ?? this.currentUser()?.prenom ?? '',
          telephone: data?.utilisateur?.telephone ?? data?.telephone ?? this.currentUser()?.telephone ?? '',
          qrCode: data?.qrCode ?? '',
          dateNaissance: data?.dateNaissance,
          groupeSanguin: data?.groupeSanguin
        };

        this.patientInfo.set(info);

        // Génère QR Code avec les données patient si pas de qrCode en base
        const qrData = info.qrCode || `BAOBAO-${info.id}-${info.telephone}`;
        this.qrCodeUrl.set(
          `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=0D2B1A&margin=10`
        );

        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger votre QR Code.');
        this.isLoading.set(false);
      }
    });
  }

  downloadQrCode() {
    const url = this.qrCodeUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${this.patientInfo()?.nom ?? 'patient'}.png`;
    a.target = '_blank';
    a.click();
  }

  async shareQrCode() {
    if (navigator.share) {
      await navigator.share({
        title: 'Mon QR Code BaoBaoHealth',
        text: `QR Code de ${this.patientInfo()?.prenom} ${this.patientInfo()?.nom}`,
        url: this.qrCodeUrl()
      });
    }
  }

  getInitiales(): string {
    const p = this.patientInfo();
    const prenom = p?.prenom ?? this.currentUser()?.prenom ?? '';
    const nom = p?.nom ?? this.currentUser()?.nom ?? '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '??';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }
}