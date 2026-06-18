import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProfilModalComponent } from '../profil-modal/profil-modal.component';

@Component({
  selector: 'app-pharmacien-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, ProfilModalComponent],
  templateUrl: './pharmacien-layout.component.html',
  styleUrl: './pharmacien-layout.component.scss'
})
export class PharmacienLayoutComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);

  currentUser           = this.authService.currentUser;
  doitChangerMotDePasse = this.authService.doitChangerMotDePasse;
  sidebarOpen           = signal(false);
  showLogoutConfirm     = signal(false);
  showProfil            = signal(false);

  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }
  askLogout()      { this.showLogoutConfirm.set(true); }
  cancelLogout()   { this.showLogoutConfirm.set(false); }
  confirmLogout()  { this.showLogoutConfirm.set(false); this.authService.logout(); }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  navItems = [
    { labelKey: 'PHARMACIEN.NAV_ORDONNANCES',  icon: 'pi-file',    route: '/pharmacien/ordonnances'  },
    { labelKey: 'PHARMACIEN.NAV_STOCKS',       icon: 'pi-box',     route: '/pharmacien/stocks'       }
  ];
}
