import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';

interface Structure {
  id: string; nom: string; type: string; prefecture: string;
  adresse?: string; latitude?: number; longitude?: number; telephone?: string;
  estActive: boolean; _count?: { utilisateurs: number };
  utilisateurs?: { prenom: string; nom: string; telephone: string }[];
}

interface MotDePasseAffiche {
  structureNom: string;
  adminNom: string;
  adminTelephone: string;
  motDePasse: string;
}

@Component({
  selector: 'app-structures',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, SelectModule, InputTextModule, InputNumberModule, SkeletonModule],
  templateUrl: './structures.component.html',
  styleUrl: './structures.component.scss'
})
export class StructuresComponent implements OnInit {
  private api = inject(ApiService);

  structures = signal<Structure[]>([]);
  isLoading = signal(true);
  showForm = signal(false);
  isSaving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  mdpAffiche = signal<MotDePasseAffiche | null>(null);

  newStructure = {
    nom: '', type: 'CENTRE', prefecture: '', adresse: '',
    latitude: null as number | null, longitude: null as number | null, telephone: '',
    admin: { prenom: '', nom: '', telephone: '', email: '' }
  };

  typeOptions = [
    { label: 'Poste de Santé', value: 'POSTE' },
    { label: 'Centre de Santé', value: 'CENTRE' },
    { label: 'Hôpital Préfectoral', value: 'HOPITAL_PREF' },
    { label: 'Hôpital Régional', value: 'HOPITAL_REG' },
    { label: 'CHU', value: 'CHU' },
    { label: 'Clinique Privée', value: 'CLINIQUE' },
    { label: 'Pharmacie Privée', value: 'PHARMACIE' }
  ];

  prefectures = ['Conakry', 'Kindia', 'Boké', 'Mamou', 'Labé', 'Faranah', 'Kankan', 'Nzérékoré', 'Coyah', 'Dubréka', 'Forécariah', 'Fria', 'Télimélé', 'Pita', 'Dalaba', 'Tougué', 'Dinguiraye', 'Kouroussa', 'Siguiri', 'Mandiana', 'Kérouané', 'Macenta', 'Guékédou', 'Kissidougou', 'Beyla', 'Lola', 'Yomou'].map(p => ({ label: p, value: p }));

  ngOnInit() { this.loadStructures(); }

  loadStructures() {
    this.isLoading.set(true);
    this.api.get<any>('/admin-structure/structures').subscribe({
      next: r => { this.structures.set(Array.isArray(r) ? r : r?.data ?? []); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); }
    });
  }

  creerStructure() {
    if (!this.newStructure.nom || !this.newStructure.prefecture) {
      this.errorMsg.set('Nom et préfecture sont obligatoires.'); return;
    }
    if (!this.newStructure.admin.prenom || !this.newStructure.admin.nom || !this.newStructure.admin.telephone) {
      this.errorMsg.set('Prénom, nom et téléphone du responsable sont obligatoires.'); return;
    }
    this.isSaving.set(true); this.errorMsg.set('');

    const payload = {
      nom: this.newStructure.nom,
      type: this.newStructure.type,
      prefecture: this.newStructure.prefecture,
      adresse: this.newStructure.adresse || undefined,
      telephone: this.newStructure.telephone || undefined,
      latitude: this.newStructure.latitude || undefined,
      longitude: this.newStructure.longitude || undefined,
      admin: {
        prenom: this.newStructure.admin.prenom,
        nom: this.newStructure.admin.nom,
        telephone: this.newStructure.admin.telephone,
        email: this.newStructure.admin.email || undefined
      }
    };

    this.api.post<any>('/admin-structure/structures', payload).subscribe({
      next: (r) => {
        const data = r?.data ?? r;
        this.isSaving.set(false);
        this.showForm.set(false);
        this.newStructure = {
          nom: '', type: 'CENTRE', prefecture: '', adresse: '',
          latitude: null, longitude: null, telephone: '',
          admin: { prenom: '', nom: '', telephone: '', email: '' }
        };

        // Si email fourni → email envoyé, pas besoin d'afficher le MDP
        if (data.admin?.email) {
          this.successMsg.set(`✅ Structure créée ! Les identifiants ont été envoyés par email à ${data.admin.email}`);
          setTimeout(() => this.successMsg.set(''), 6000);
        } else {
          // Pas d'email → afficher MDP UNE SEULE FOIS
          this.mdpAffiche.set({
            structureNom: data.structure?.nom ?? payload.nom,
            adminNom: `${data.admin?.prenom ?? ''} ${data.admin?.nom ?? ''}`,
            adminTelephone: data.admin?.telephone ?? payload.admin.telephone,
            motDePasse: data.motDePasseTemporaire
          });
        }
        this.loadStructures();
      },
      error: err => { this.isSaving.set(false); this.errorMsg.set(err?.error?.error ?? 'Erreur lors de la création.'); }
    });
  }

  fermerMdp() { this.mdpAffiche.set(null); }

  getTypeLabel(type: string): string {
    return this.typeOptions.find(t => t.value === type)?.label ?? type;
  }

  getAdmin(s: Structure): string {
    if (!s.utilisateurs?.length) return 'Aucun responsable';
    const a = s.utilisateurs[0];
    return `${a.prenom} ${a.nom} — ${a.telephone}`;
  }
}