import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProfilModalComponent } from '../profil-modal/profil-modal.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe,
    ProfilModalComponent, AvatarComponent,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatBadgeModule, MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);
  private dialog        = inject(MatDialog);

  currentUser           = this.authService.currentUser;
  doitChangerMotDePasse = this.authService.doitChangerMotDePasse;
  sidebarOpen           = signal(false);
  showProfil            = signal(false);

  constructor(iconRegistry: MatIconRegistry) {
    // PrimeIcons est déjà embarqué localement : on l'expose comme font set
    // Material plutôt que d'ajouter Material Symbols (plusieurs Mo), la
    // plateforme visant des connexions à faible débit.
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
  toggleTheme()    { this.themeService.toggle(); }
  toggleLang()     { this.i18nService.toggle(); }

  askLogout() {
    const data: ConfirmDialogData = {
      titre: this.i18nService.t('COMMON.LOGOUT_CONFIRM_TITLE'),
      texte: this.i18nService.t('COMMON.LOGOUT_CONFIRM_TEXT'),
      confirmer: this.i18nService.t('COMMON.LOGOUT'),
      annuler: this.i18nService.t('COMMON.CANCEL'),
      icone: 'pi-sign-out',
      danger: true,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '380px', autoFocus: false })
      .afterClosed().subscribe(confirme => { if (confirme) this.authService.logout(); });
  }

  getInitiales(): string {
    const u = this.currentUser();
    if (!u) return '??';
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  navItems = [
    { labelKey: 'ADMIN.NAV_ANALYTICS',  icon: 'pi-chart-bar', route: '/admin/analytics'  },
    { labelKey: 'ADMIN.NAV_STRUCTURES', icon: 'pi-building',  route: '/admin/structures' },
    { labelKey: 'ADMIN.NAV_EXPORT',     icon: 'pi-download',  route: '/admin/export'     },
    { labelKey: 'Paramètres',           icon: 'pi-cog',       route: '/admin/settings'   }
  ];
}
