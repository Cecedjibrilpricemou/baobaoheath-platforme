// shared/components/asc-layout/asc-layout.component.ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProfilModalComponent } from '../profil-modal/profil-modal.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

const ROUTE_LABELS: Record<string, string> = {
  '/asc/consultations':   'ASC.NAV_CONSULTATIONS',
  '/asc/triage':          'Triage IA',
  '/asc/stocks':          'ASC.NAV_STOCKS',
  '/asc/planning':        'ASC.NAV_PLANNING',
  '/asc/sync':            'Synchronisation',
};

@Component({
  selector: 'app-asc-layout',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe,
    ProfilModalComponent, AvatarComponent,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './asc-layout.component.html',
  styleUrl: './asc-layout.component.scss'
})
export class AscLayoutComponent {
  private authService   = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private i18nService   = inject(I18nService);
  private router        = inject(Router);
  private dialog        = inject(MatDialog);
  private offlineQueue  = inject(OfflineQueueService);

  currentUser           = this.authService.currentUser;
  doitChangerMotDePasse = this.authService.doitChangerMotDePasse;
  sidebarOpen           = signal(false);
  showProfil            = signal(false);
  pendingCount          = this.offlineQueue.nbEnAttente;

  // ── Connectivité ─────────────────────────────────────────────────
  isOnline         = signal(navigator.onLine);
  justCameOnline   = signal(false);
  private onlineTimer?: ReturnType<typeof setTimeout>;

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.justCameOnline.set(true);
      clearTimeout(this.onlineTimer);
      this.onlineTimer = setTimeout(() => this.justCameOnline.set(false), 4000);
    });
    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.justCameOnline.set(false);
    });

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.currentRoute.set((e as NavigationEnd).urlAfterRedirects);
    });
  }

  // ── Fil d'Ariane ─────────────────────────────────────────────────
  currentRoute = signal(this.router.url);

  readonly pageLabel = computed(() => {
    const url = this.currentRoute();
    const exact = ROUTE_LABELS[url];
    if (exact) return exact;
    const base = Object.keys(ROUTE_LABELS).find(k => url.startsWith(k));
    return base ? ROUTE_LABELS[base] : 'ASC.ROLE';
  });

  // ── Actions ──────────────────────────────────────────────────────
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
    { labelKey: 'ASC.NAV_CONSULTATIONS', icon: 'pi-heart',     route: '/asc/consultations' },
    { labelKey: 'Triage IA',             icon: 'pi-bolt',      route: '/asc/triage'        },
    { labelKey: 'ASC.NAV_STOCKS',        icon: 'pi-box',       route: '/asc/stocks'        },
    { labelKey: 'ASC.NAV_PLANNING',      icon: 'pi-calendar',  route: '/asc/planning'      },
    { labelKey: 'Synchronisation',       icon: 'pi-sync',      route: '/asc/sync'          }
  ];
}
