import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import type { ApiResponse } from '@baobaoheath/shared-types';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

type EvenementConnexion = {
  id: string;
  type: 'CONNEXION_REUSSIE' | 'ECHEC_AUTHENTIFICATION' | 'ECHEC_CODE' | 'DECONNEXION';
  ipAdresse: string | null;
  userAgent: string | null;
  creeLe: string;
  utilisateur: {
    id: string;
    prenom: string;
    nom: string;
    email: string | null;
    pharmacienProfile: { roleOfficine: string } | null;
  } | null;
};

type JournalConnexions = {
  items: EvenementConnexion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Component({
  selector: 'app-pharmacien-connexions',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './connexions.component.html',
  styleUrl: './connexions.component.scss',
})
export class ConnexionsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly journal = signal<JournalConnexions | null>(null);
  readonly isLoading = signal(true);
  readonly erreur = signal(false);

  ngOnInit(): void {
    this.charger(1);
  }

  charger(page: number): void {
    this.isLoading.set(true);
    this.erreur.set(false);
    this.api.get<ApiResponse<JournalConnexions>>('/pharmacien/connexions', {
      page: String(page),
      limit: '25',
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.journal.set(response.data);
        } else {
          this.erreur.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
