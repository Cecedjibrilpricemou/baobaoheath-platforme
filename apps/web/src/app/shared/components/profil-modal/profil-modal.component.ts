// shared/components/profil-modal/profil-modal.component.ts
import { Component, inject, signal, OnInit, input, output } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AvatarComponent } from '../avatar/avatar.component';

type Tab = 'profil' | 'password';

const TAILLE_MAX_PHOTO = 3 * 1024 * 1024;
const TYPES_PHOTO_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-profil-modal',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,CommonModule, FormsModule, TranslatePipe, AvatarComponent],
  templateUrl: './profil-modal.component.html',
  styleUrl: './profil-modal.component.scss'
})
export class ProfilModalComponent implements OnInit {
  private authService = inject(AuthService);
  private i18n = inject(I18nService);

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
  isUploadingPhoto = signal(false);

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
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_NAME_REQUIRED')); return;
    }
    this.isSaving.set(true); this.errorMsg.set('');

    this.authService.updateProfil(this.profilForm).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showSuccess(this.i18n.t('PROFIL_MODAL.SUCCESS_UPDATED'));
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.error ?? this.i18n.t('PROFIL_MODAL.ERR_UPDATE'));
      }
    });
  }

  // ── Changer le mot de passe ─────────────────────────────────────
  savePassword() {
    if (this.passwordForm.nouveauMotDePasse.length < 6) {
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_PWD_SHORT')); return;
    }
    if (this.passwordForm.nouveauMotDePasse !== this.passwordForm.confirmation) {
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_PWD_MATCH')); return;
    }
    if (!this.forcerChangement() && !this.passwordForm.ancienMotDePasse) {
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_OLD_PWD_REQUIRED')); return;
    }

    this.isSaving.set(true); this.errorMsg.set('');

    const dto = this.forcerChangement()
      ? { nouveauMotDePasse: this.passwordForm.nouveauMotDePasse }
      : { ancienMotDePasse: this.passwordForm.ancienMotDePasse, nouveauMotDePasse: this.passwordForm.nouveauMotDePasse };

    this.authService.changerMotDePasse(dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.passwordForm = { ancienMotDePasse: '', nouveauMotDePasse: '', confirmation: '' };
        this.showSuccess(this.i18n.t('PROFIL_MODAL.SUCCESS_PWD_CHANGED'));
        // Si changement forcé → fermer après 1.5s
        if (this.forcerChangement()) {
          setTimeout(() => this.fermer.emit(), 1500);
        }
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.error ?? this.i18n.t('PROFIL_MODAL.ERR_PWD_CHANGE'));
      }
    });
  }

  // ── Photo de profil ──────────────────────────────────────────────
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de resélectionner le même fichier plus tard
    if (!file) return;

    if (!TYPES_PHOTO_ACCEPTES.includes(file.type)) {
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_PHOTO_TYPE')); return;
    }
    if (file.size > TAILLE_MAX_PHOTO) {
      this.errorMsg.set(this.i18n.t('PROFIL_MODAL.ERR_PHOTO_SIZE')); return;
    }

    this.isUploadingPhoto.set(true); this.errorMsg.set('');
    this.authService.uploadAvatar(file).subscribe({
      next: ({ url }) => {
        this.authService.updateProfil({ photoUrl: url }).subscribe({
          next: () => {
            this.isUploadingPhoto.set(false);
            this.showSuccess(this.i18n.t('PROFIL_MODAL.SUCCESS_PHOTO_UPDATED'));
          },
          error: err => {
            this.isUploadingPhoto.set(false);
            this.errorMsg.set(err?.error?.error ?? this.i18n.t('PROFIL_MODAL.ERR_UPDATE'));
          }
        });
      },
      error: err => {
        this.isUploadingPhoto.set(false);
        this.errorMsg.set(err?.error?.error ?? this.i18n.t('PROFIL_MODAL.ERR_PHOTO_UPLOAD'));
      }
    });
  }

  fermerModal() {
    if (this.forcerChangement()) return; // impossible de fermer sans changer
    this.fermer.emit();
  }

  getRoleLabel(): string {
    const map: Record<string, string> = {
      'PATIENT': this.i18n.t('PATIENT.ROLE'),
      'ASC': this.i18n.t('ASC.ROLE'),
      'ASC_SUPERVISOR': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_ASC_SUPERVISOR'),
      'MEDECIN': this.i18n.t('MEDECIN.ROLE'),
      'PHARMACIEN': this.i18n.t('PHARMACIEN.ROLE'),
      'ADMIN_STRUCTURE': this.i18n.t('ADMIN_STRUCTURE.ROLE'),
      'ADMIN_REGIONAL': this.i18n.t('PROFIL_MODAL.ROLE_ADMIN_REGIONAL'),
      'ADMIN_NATIONAL': this.i18n.t('PROFIL_MODAL.ROLE_ADMIN_NATIONAL'),
      'SUPER_ADMIN': this.i18n.t('PROFIL_MODAL.ROLE_SUPER_ADMIN')
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
