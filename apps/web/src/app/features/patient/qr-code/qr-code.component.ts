// features/patient/qr-code/qr-code.component.ts
// Rôle : affichage du QR Code du patient
// Le QR Code permet aux ASC de scanner et accéder au dossier patient

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

    // Données patient
    patientInfo = signal<PatientInfo | null>(null);
    qrCodeUrl = signal<string>('');

    // États UI
    isLoading = signal(true);
    errorMessage = signal('');

    ngOnInit() {
        this.loadPatientInfo();
    }

    private loadPatientInfo() {
        this.isLoading.set(true);

        this.api.get<PatientInfo>('/patients/me').subscribe({
            next: (data) => {
                this.patientInfo.set(data);
                // Génère l'URL du QR Code via l'API QR Code Google
                // En production utiliser une lib Angular dédiée
                if (data.qrCode) {
                    const qrData = encodeURIComponent(data.qrCode);
                    this.qrCodeUrl.set(
                        `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}&bgcolor=ffffff&color=0D2B1A&margin=10`
                    );
                }
                this.isLoading.set(false);
            },
            error: () => {
                this.errorMessage.set('Impossible de charger votre QR Code.');
                this.isLoading.set(false);
            }
        });
    }

    // Télécharger le QR Code
    downloadQrCode() {
        const url = this.qrCodeUrl();
        if (!url) return;

        const a = document.createElement('a');
        a.href = url;
        a.download = `qrcode-${this.patientInfo()?.nom}-${this.patientInfo()?.prenom}.png`;
        a.target = '_blank';
        a.click();
    }

    // Partager le QR Code (Web Share API)
    async shareQrCode() {
        if (navigator.share) {
            await navigator.share({
                title: 'Mon QR Code BaoBaoHealth',
                text: `QR Code de ${this.patientInfo()?.prenom} ${this.patientInfo()?.nom}`,
                url: this.qrCodeUrl()
            });
        }
    }

    // Initiales pour l'avatar
    getInitiales(): string {
        const p = this.patientInfo();
        if (!p) return '??';
        return `${p.prenom?.charAt(0) ?? ''}${p.nom?.charAt(0) ?? ''}`.toUpperCase();
    }

    // Formate date
    formatDate(dateStr?: string): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}