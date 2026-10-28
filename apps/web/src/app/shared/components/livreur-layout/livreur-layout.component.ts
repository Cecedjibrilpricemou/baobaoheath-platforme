import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { LayoutService } from '../../services/layout.service';
import { ThemeService } from '../../services/theme.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { BrandComponent } from '../brand/brand.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { ProfilModalComponent } from '../profil-modal/profil-modal.component';
import { TopbarCrumbComponent } from '../topbar-crumb/topbar-crumb.component';

@Component({
  selector: 'app-livreur-layout',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe,
    BrandComponent, ProfilModalComponent, AvatarComponent, NotificationBellComponent, TopbarCrumbComponent,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './livreur-layout.component.html',
  styleUrl: './livreur-layout.component.scss',
})
export class LivreurLayoutComponent {
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly layout = inject(LayoutService);
  private readonly i18nService = inject(I18nService);
  private readonly dialog = inject(MatDialog);

  readonly currentUser = this.authService.currentUser;
  readonly doitChangerMotDePasse = this.authService.doitChangerMotDePasse;
  readonly sidebarOpen = signal(false);
  readonly showProfil = signal(false);

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  toggleSidebar(): void {
    if (this.layout.estMobile()) this.sidebarOpen.update((value) => !value);
    else this.layout.basculerRepli();
  }

  closeSidebar(): void { this.sidebarOpen.set(false); }
  toggleTheme(): void { this.themeService.toggle(); }
  toggleLang(): void { this.i18nService.toggle(); }

  askLogout(): void {
    const data: ConfirmDialogData = {
      titre: this.i18nService.t('COMMON.LOGOUT_CONFIRM_TITLE'),
      texte: this.i18nService.t('COMMON.LOGOUT_CONFIRM_TEXT'),
      confirmer: this.i18nService.t('COMMON.LOGOUT'),
      annuler: this.i18nService.t('COMMON.CANCEL'),
      icone: 'pi-sign-out',
      danger: true,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '380px', autoFocus: false })
      .afterClosed().subscribe((confirme) => { if (confirme) this.authService.logout(); });
  }

  getInitiales(): string {
    const user = this.currentUser();
    if (!user) return '??';
    return `${user.prenom?.charAt(0) ?? ''}${user.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  readonly navItems = [
    { labelKey: 'LIVREUR.NAV_COURSES', icon: 'pi-bell', route: '/livreur/courses' },
    { labelKey: 'LIVREUR.NAV_MES_COURSES', icon: 'pi-truck', route: '/livreur/mes-courses' },
  ];
}
