// shared/components/patient-layout/patient-layout.component.ts
// Rôle : layout partagé pour toutes les pages du module Patient
// Contient : sidebar navigation + header + zone contenu

import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-patient-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './patient-layout.component.html',
  styleUrl: './patient-layout.component.scss'
})
export class PatientLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  // Toggle sidebar sur mobile
  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  // Initiales avatar
  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  // Déconnexion
  logout() {
    this.authService.logout();
  }

  // Navigation items
  navItems = [
    {
      label: 'Dashboard',
      icon: 'pi-home',
      route: '/patient/dashboard'
    },
    {
      label: 'Mon Profil',
      icon: 'pi-user',
      route: '/patient/profil'
    },
    {
      label: 'QR Code',
      icon: 'pi-qrcode',
      route: '/patient/qr-code'
    }
  ];
}