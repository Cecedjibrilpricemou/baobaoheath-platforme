// shared/components/notification-bell/notification-bell.component.ts
// Cloche de la barre superieure, commune aux six layouts. Compteur non-lues
// au chargement, mise a jour en temps reel via `notification:new`, liste
// deroulante chargee a l'ouverture du menu.
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { NotificationService, NotificationView } from '../../../core/services/notification.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

const LIMITE_MENU = 10;

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule, TranslatePipe,
    MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
  ],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private i18n = inject(I18nService);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly nonLues = this.notificationService.nonLues;
  notifications = signal<NotificationView[]>([]);
  isLoading = signal(false);
  private chargeUneFois = false;

  ngOnInit() {
    this.notificationService.rafraichirNonLues().subscribe({ error: () => { /* la cloche reste a 0 */ } });

    this.notificationService.nouvelles$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(notification => {
        this.nonLues.update(n => n + 1);
        if (this.chargeUneFois) {
          this.notifications.update(liste => [notification, ...liste].slice(0, LIMITE_MENU));
        }
        this.toastr.info(notification.contenu, notification.titre);
      });
  }

  ouvrir() {
    this.charger();
  }

  charger() {
    this.isLoading.set(true);
    this.notificationService.getNotifications(1, LIMITE_MENU).subscribe({
      next: res => {
        this.notifications.set(res.data?.items ?? []);
        this.chargeUneFois = true;
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  ouvrirNotification(n: NotificationView) {
    if (!n.luLe) {
      this.notificationService.marquerLue(n.id).subscribe({
        next: res => {
          const lue = res.data ?? { ...n, luLe: new Date() };
          this.notifications.update(liste => liste.map(x => x.id === n.id ? lue : x));
          this.nonLues.update(c => Math.max(0, c - 1));
        },
        error: () => { /* on navigue quand meme */ }
      });
    }
    if (n.lienAction) this.router.navigateByUrl(n.lienAction);
  }

  toutMarquerLu(event: Event) {
    event.stopPropagation();
    this.notificationService.toutMarquerLu().subscribe({
      next: () => {
        const maintenant = new Date();
        this.notifications.update(liste => liste.map(x => x.luLe ? x : { ...x, luLe: maintenant }));
      },
      error: () => {
        this.toastr.error(this.i18n.t('NOTIFICATIONS.ERR_MARK_ALL'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });
  }

  icone(n: NotificationView): string {
    switch (n.type) {
      case 'NOUVEAU_MESSAGE':        return 'pi-comment';
      case 'ORDONNANCE_SIGNEE':      return 'pi-file-check';
      case 'REFERENCEMENT_ACCEPTE':  return 'pi-check-circle';
      case 'REFERENCEMENT_REFUSE':   return 'pi-times-circle';
      case 'ALERTE_STOCK':           return 'pi-box';
      case 'RAPPEL_RENDEZ_VOUS':     return 'pi-calendar';
      case 'RAPPEL_VACCINATION':     return 'pi-shield';
      case 'ALERTE_VITALE':          return 'pi-exclamation-triangle';
      default:                       return 'pi-bell';
    }
  }
}
