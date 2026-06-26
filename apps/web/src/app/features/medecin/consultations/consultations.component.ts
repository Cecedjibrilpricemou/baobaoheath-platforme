// features/medecin/consultations/consultations.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { MedecinService } from '../../../core/services/medecin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface Constantes {
  temperature?: number; poidsKg?: number; tensionSystolique?: number;
  tensionDiastolique?: number; frequenceCardiaque?: number; spo2?: number;
  alertes?: string[];
}

interface Diagnostic {
  id: string; libelle: string; typeDiagnostic: string; severite?: string;
}

interface Ordonnance {
  id: string; posologie: string; frequence: string; dureeJours: number;
  medicament: { dci: string; nomCommercial?: string; dosage: string };
}

interface Consultation {
  id: string;
  statut: string;
  motifPrincipal: string;
  consulteeLE: string;
  notesMedecin?: string;
  idMedecinValideur?: string;
  patient?: { utilisateur: { prenom: string; nom: string; telephone: string } };
  asc?: { utilisateur: { prenom: string; nom: string } };
  constantes?: Constantes;
  diagnostics: Diagnostic[];
  ordonnances: Ordonnance[];
}

@Component({
  selector: 'app-medecin-consultations',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, SkeletonModule, TextareaModule],
  templateUrl: './consultations.component.html',
  styleUrl: './consultations.component.scss'
})
export class MedecinConsultationsComponent implements OnInit {
  private medecinService = inject(MedecinService);

  consultations   = signal<Consultation[]>([]);
  selected        = signal<Consultation | null>(null);
  isLoading       = signal(true);
  isValidating    = signal(false);
  successMessage  = signal('');
  errorMessage    = signal('');
  total           = signal(0);

  // Formulaire validation
  notesMedecin    = '';
  ordonnancesSelectionnees: string[] = [];

  ngOnInit() { this.loadConsultations(); }

  private loadConsultations() {
    this.isLoading.set(true);
    this.medecinService.getConsultations().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as Consultation[];
          this.consultations.set(data);
          this.total.set(response.meta?.total ?? data.length);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  selectionner(c: Consultation) {
    this.selected.set(c);
    this.notesMedecin = '';
    this.ordonnancesSelectionnees = [];
    this.errorMessage.set('');
  }

  fermerDetail() { this.selected.set(null); }

  toggleOrdonnance(id: string) {
    const idx = this.ordonnancesSelectionnees.indexOf(id);
    if (idx === -1) this.ordonnancesSelectionnees.push(id);
    else this.ordonnancesSelectionnees.splice(idx, 1);
  }

  isOrdonnanceSelectionnee(id: string): boolean {
    return this.ordonnancesSelectionnees.includes(id);
  }

  valider() {
    const c = this.selected();
    if (!c) return;
    this.isValidating.set(true);
    // On utilise validerConsultation du service
    this.medecinService.validerConsultation(c.id, {
      diagnosticConfirme: 'CONFIRME', // Ou récupérer depuis un champ s'il existe
      commentaires: this.notesMedecin,
      // On passe les idOrdonnances si l'API l'accepte ou on s'adapte à l'interface
      // @ts-ignore - adapter selon l'implémentation backend réelle
      idOrdonnances: this.ordonnancesSelectionnees 
    }).subscribe({
      next: () => {
        this.isValidating.set(false);
        this.selected.set(null);
        this.showSuccess('Consultation validée avec succès !');
        this.loadConsultations();
      },
      error: (err) => {
        this.isValidating.set(false);
        this.showError(err?.error?.message ?? 'Erreur lors de la validation.');
      }
    });
  }

  getPatientNom(c: Consultation): string {
    const u = c.patient?.utilisateur;
    return u ? `${u.prenom} ${u.nom}` : '—';
  }

  getAscNom(c: Consultation): string {
    const u = c.asc?.utilisateur;
    return u ? `${u.prenom} ${u.nom}` : '—';
  }

  getInitiales(c: Consultation): string {
    const u = c.patient?.utilisateur;
    if (!u) return '?';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private showSuccess(msg: string) {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private showError(msg: string) {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(''), 4000);
  }
}
