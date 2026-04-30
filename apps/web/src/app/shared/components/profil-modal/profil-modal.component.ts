// shared/components/profil-modal/profil-modal.component.ts
import { Component, inject, signal, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';

type Tab = 'profil' | 'password';

@Component({
  selector: 'app-profil-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './profil-modal.component.html',
  styleUrl: './profil-modal.component.scss'
})
export class ProfilModalComponent implements OnInit {
  private authService = inject(AuthService);

  // Input/Output
  forcerChangement = input<boolean>(false); // true si doitChangerMotDePasse
  fermer = output<void>();

  currentUser = this.authService.currentUser;
  activeTab   = signal<Tab>('profil');
  isSaving    = signal(false);
  successMsg  = signal('');
  errorMsg    = signal('');

  // Formulaire profil
  profilForm = { prenom: '', nom: '', email: '', telephone: '' };

  // Formulaire mot de passe
  passwordForm = { ancienMotDePasse: '', nouveauMotDePasse: '', confirmation: '' };
  showAncien   = signal(false);
  showNouveau  = signal(false);
  showConfirm  = signal(false);

  ngOnInit() {
    const u = this.currentUser();
    if (u) {
      this.profilForm = {
        prenom: u.prenom, nom: u.nom,
        email: u.email ?? '', telephone: u.telephone
      };
    }
    // Si changement forcé → aller directement sur l'onglet mot de passe
    if (this.forcerChangement()) {
      this.activeTab.set('password');
    }
  }

  setTab(tab: Tab) {
    if (this.forcerChangement()) return; // bloquer si changement forcé
    this.activeTab.set(tab);
    this.successMsg.set('');
    this.errorMsg.set('');
  }

  // ── Sauvegarder le profil ───────────────────────────────────────
  saveProfil() {
    if (!this.profilForm.prenom || !this.profilForm.nom) {
      this.errorMsg.set('Prénom et nom sont obligatoires.'); return;
    }
    this.isSaving.set(true); this.errorMsg.set('');

    this.authService.updateProfil(this.profilForm).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showSuccess('Profil mis à jour avec succès !');
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.error ?? 'Erreur lors de la mise à jour.');
      }
    });
  }

  // ── Changer le mot de passe ─────────────────────────────────────
  savePassword() {
    if (this.passwordForm.nouveauMotDePasse.length < 6) {
      this.errorMsg.set('Le mot de passe doit contenir au moins 6 caractères.'); return;
    }
    if (this.passwordForm.nouveauMotDePasse !== this.passwordForm.confirmation) {
      this.errorMsg.set('Les mots de passe ne correspondent pas.'); return;
    }
    if (!this.forcerChangement() && !this.passwordForm.ancienMotDePasse) {
      this.errorMsg.set('L\'ancien mot de passe est obligatoire.'); return;
    }

    this.isSaving.set(true); this.errorMsg.set('');

    const dto = this.forcerChangement()
      ? { nouveauMotDePasse: this.passwordForm.nouveauMotDePasse }
      : { ancienMotDePasse: this.passwordForm.ancienMotDePasse, nouveauMotDePasse: this.passwordForm.nouveauMotDePasse };

    this.authService.changerMotDePasse(dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.passwordForm = { ancienMotDePasse: '', nouveauMotDePasse: '', confirmation: '' };
        this.showSuccess('Mot de passe changé avec succès !');
        // Si changement forcé → fermer après 1.5s
        if (this.forcerChangement()) {
          setTimeout(() => this.fermer.emit(), 1500);
        }
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.error ?? 'Erreur lors du changement.');
      }
    });
  }

  fermerModal() {
    if (this.forcerChangement()) return; // impossible de fermer sans changer
    this.fermer.emit();
  }

  getRoleLabel(): string {
    const map: Record<string, string> = {
      'PATIENT': 'Patient', 'ASC': 'Agent de Santé',
      'ASC_SUPERVISOR': 'Superviseur ASC', 'MEDECIN': 'Médecin',
      'PHARMACIEN': 'Pharmacien', 'ADMIN_STRUCTURE': 'Admin Structure',
      'ADMIN_REGIONAL': 'Admin Régional', 'ADMIN_NATIONAL': 'Admin National',
      'SUPER_ADMIN': 'Super Administrateur'
    };
    return map[this.currentUser()?.role ?? ''] ?? '';
  }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  private showSuccess(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3000);
  }
}
