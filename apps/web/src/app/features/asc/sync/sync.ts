import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { OfflineQueueService, MutationEnAttente } from '../../../core/services/offline-queue.service';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './sync.html',
  styleUrl: './sync.scss',
})
export class Sync {
  private queue = inject(OfflineQueueService);
  private i18n = inject(I18nService);

  isOnline = this.queue.isOnline;
  isSyncing = this.queue.isSyncing;
  derniereSync = this.queue.derniereSync;
  derniereErreur = this.queue.derniereErreur;

  pendingItems = this.queue.file;
  nbEnAttente = this.queue.nbEnAttente;
  peutSynchroniser = computed(() => this.isOnline() && this.nbEnAttente() > 0 && !this.isSyncing());

  startSync() {
    this.queue.synchroniser();
  }

  abandonner(item: MutationEnAttente) {
    this.queue.retirer(item.clientMutationId);
  }

  /** Icône par type d'entité mis en file. */
  iconeEntite(entityType: string): string {
    // Types alignés sur ceux acceptés par applyMutation() côté API.
    const map: Record<string, string> = {
      Consultation: 'pi-file-edit text-blue-500',
      PatientProfile: 'pi-user-plus text-green-500',
      ConstantesVitales: 'pi-heart text-rose-500',
      Vaccination: 'pi-shield text-teal-500',
      Stock: 'pi-box text-purple-500',
    };
    return map[entityType] ?? 'pi-database text-gray-500';
  }

  /** « il y a 2 h », « il y a 5 min »… à partir de l'horodatage de mise en file. */
  depuis(queuedAt: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(queuedAt).getTime()) / 60000));
    if (minutes < 1) return this.i18n.t('ASC.SYNC.JUST_NOW');
    if (minutes < 60) return this.i18n.t('ASC.SYNC.MINUTES_AGO', { m: minutes });
    return this.i18n.t('ASC.SYNC.HOURS_AGO', { h: Math.round(minutes / 60) });
  }

  formatDerniereSync(): string {
    const iso = this.derniereSync();
    if (!iso) return this.i18n.t('ASC.SYNC.NEVER_SYNCED');
    return new Date(iso).toLocaleString(this.i18n.lang() === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
