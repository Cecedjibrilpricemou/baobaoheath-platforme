// features/admin/structures/structures.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { AdminService } from '../../../core/services/admin.service';
import { ToastrService } from 'ngx-toastr';

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

interface CreateStructureResponse {
  structure?: { nom: string };
  pharmacie?: { nom: string };
  admin?: { prenom: string; nom: string; telephone: string; email?: string };
  pharmacien?: { prenom: string; nom: string; telephone: string; email?: string };
  motDePasseTemporaire?: string;
}

@Component({
  selector: 'app-structures',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, SelectModule, InputTextModule, InputNumberModule, SkeletonModule],
  templateUrl: './structures.component.html',
  styleUrl: './structures.component.scss'
})
export class StructuresComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastr       = inject(ToastrService);

  structures        = signal<Structure[]>([]);
  isLoading         = signal(true);
  showForm          = signal(false);
  isSaving          = signal(false);
  isToggling        = signal<string | null>(null); // id de la structure en cours de toggle
  confirmDesactiver = signal<Structure | null>(null); // modal confirmation

  mdpAffiche = signal<MotDePasseAffiche | null>(null);

  newStructure = {
    nom: '', type: 'CENTRE', prefecture: '', adresse: '',
    latitude: null as number | null, longitude: null as number | null, telephone: '',
    admin: { prenom: '', nom: '', telephone: '', email: '' }
  };

  typeOptions = [
    { label: 'Poste de Santé',      value: 'POSTE'        },
    { label: 'Centre de Santé',     value: 'CENTRE'       },
    { label: 'Hôpital Préfectoral', value: 'HOPITAL_PREF' },
    { label: 'Hôpital Régional',    value: 'HOPITAL_REG'  },
    { label: 'CHU',                 value: 'CHU'          },
    { label: 'Clinique Privée',     value: 'CLINIQUE'     },
    { label: 'Pharmacie Privée',    value: 'PHARMACIE'    }
  ];

  prefectures = ['Conakry','Kindia','Boké','Mamou','Labé','Faranah','Kankan','Nzérékoré','Coyah','Dubréka','Forécariah','Fria','Télimélé','Pita','Dalaba','Tougué','Dinguiraye','Kouroussa','Siguiri','Mandiana','Kérouané','Macenta','Guékédou','Kissidougou','Beyla','Lola','Yomou'].map(p => ({ label: p, value: p }));

  ngOnInit() { this.loadStructures(); }

  loadStructures() {
    this.isLoading.set(true);
    this.adminService.getStructures().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const paginatedData = response.data;
          const data = Array.isArray(paginatedData) ? paginatedData : (paginatedData as unknown as { items?: Structure[] })?.items ?? [];
          this.structures.set(data);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  creerStructure() {
    if (!this.newStructure.nom || !this.newStructure.prefecture) {
      this.toastr.error('Nom et préfecture sont obligatoires.', 'Validation'); return;
    }
    if (!this.newStructure.admin.prenom || !this.newStructure.admin.nom || !this.newStructure.admin.telephone) {
      this.toastr.error('Prénom, nom et téléphone du responsable sont obligatoires.', 'Validation'); return;
    }
    this.isSaving.set(true);

    const nomStructureCree = this.newStructure.nom;
    const telephoneAdminSaisi = this.newStructure.admin.telephone;

    let request$;

    if (this.newStructure.type === 'PHARMACIE') {
      const payload = {
        nom: this.newStructure.nom,
        prefecture: this.newStructure.prefecture,
        adresse: this.newStructure.adresse || undefined,
        telephone: this.newStructure.telephone || undefined,
        latitude: this.newStructure.latitude || undefined,
        longitude: this.newStructure.longitude || undefined,
        pharmacien: {
          prenom: this.newStructure.admin.prenom,
          nom: this.newStructure.admin.nom,
          telephone: this.newStructure.admin.telephone,
          email: this.newStructure.admin.email || undefined
        }
      };
      request$ = this.adminService.createPharmacie(payload);
    } else {
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
      request$ = this.adminService.createStructure(payload);
    }

    request$.subscribe({
      next: (response) => {
        const data = (response?.data ?? response) as CreateStructureResponse;
        this.isSaving.set(false);
        this.showForm.set(false);
        this.newStructure = {
          nom: '', type: 'CENTRE', prefecture: '', adresse: '',
          latitude: null, longitude: null, telephone: '',
          admin: { prenom: '', nom: '', telephone: '', email: '' }
        };

        const adminData = data?.admin ?? data?.pharmacien;
        const structureData = data?.structure ?? data?.pharmacie;

        if (adminData?.email) {
          this.toastr.success(`Structure créée ! Les identifiants ont été envoyés par email à ${adminData.email}`, 'Succès');
        } else {
          this.mdpAffiche.set({
            structureNom: structureData?.nom ?? nomStructureCree,
            adminNom: `${adminData?.prenom ?? ''} ${adminData?.nom ?? ''}`.trim(),
            adminTelephone: adminData?.telephone ?? telephoneAdminSaisi,
            motDePasse: data?.motDePasseTemporaire ?? ''
          });
          this.toastr.success(`Structure ${nomStructureCree} créée avec succès.`, 'Succès');
        }
        this.loadStructures();
      },
      error: err => { 
        this.isSaving.set(false); 
        this.toastr.error(err?.error?.error ?? err?.error?.message ?? 'Erreur lors de la création.', 'Erreur'); 
      }
    });
  }

  // ── Demander confirmation avant désactivation ─────────────────
  demanderDesactivation(s: Structure) {
    this.confirmDesactiver.set(s);
  }

  annulerDesactivation() {
    this.confirmDesactiver.set(null);
  }

  // ── Désactiver une structure ──────────────────────────────────
  confirmerDesactivation() {
    const s = this.confirmDesactiver();
    if (!s) return;
    this.confirmDesactiver.set(null);
    this.isToggling.set(s.id);
    this.adminService.deleteStructure(s.id).subscribe({
      next: () => {
        this.isToggling.set(null);
        this.toastr.success(`Structure "${s.nom}" désactivée.`, 'Succès');
        this.loadStructures();
      },
      error: err => {
        this.isToggling.set(null);
        this.toastr.error(err?.error?.error ?? err?.error?.message ?? 'Erreur lors de la désactivation.', 'Erreur');
      }
    });
  }

  // ── Réactiver une structure ───────────────────────────────────
  reactiver(s: Structure) {
    this.isToggling.set(s.id);
    this.adminService.updateStructure(s.id, { estActive: true }).subscribe({
      next: () => {
        this.isToggling.set(null);
        this.toastr.success(`Structure "${s.nom}" réactivée.`, 'Succès');
        this.loadStructures();
      },
      error: err => {
        this.isToggling.set(null);
        this.toastr.error(err?.error?.error ?? err?.error?.message ?? 'Erreur lors de la réactivation.', 'Erreur');
      }
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