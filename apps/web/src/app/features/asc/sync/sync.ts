import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBarModule, TagModule, TranslatePipe],
  templateUrl: './sync.html',
  styleUrl: './sync.scss',
})
export class Sync {
  isOnline = signal(navigator.onLine);
  isSyncing = signal(false);
  syncProgress = signal(0);

  pendingItems = signal([
    { id: '1', type: 'Consultation', typeKey: 'ASC.SYNC.TYPE_CONSULTATION', patient: 'Aissatou Barry', hoursAgo: 2, status: 'pending' },
    { id: '2', type: 'Nouveau Patient', typeKey: 'ASC.SYNC.TYPE_NEW_PATIENT', patient: 'Ibrahima Diallo', hoursAgo: 3, status: 'pending' },
    { id: '3', type: 'Mise à jour stock', typeKey: 'ASC.SYNC.TYPE_STOCK_UPDATE', patient: 'Paracétamol', hoursAgo: 5, status: 'pending' }
  ]);

  constructor() {
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  startSync() {
    if (!this.isOnline() || this.pendingItems().length === 0) return;
    
    this.isSyncing.set(true);
    this.syncProgress.set(0);

    const interval = setInterval(() => {
      this.syncProgress.update(v => v + 20);
      
      // Mettre à jour progressivement le statut des items
      const progress = this.syncProgress();
      if (progress === 40) {
        this.updateItemStatus('1', 'synced');
      } else if (progress === 80) {
        this.updateItemStatus('2', 'synced');
      } else if (progress >= 100) {
        this.updateItemStatus('3', 'synced');
        clearInterval(interval);
        
        setTimeout(() => {
          this.isSyncing.set(false);
          this.pendingItems.set([]); // Vider la liste
        }, 1000);
      }
    }, 500);
  }

  private updateItemStatus(id: string, status: string) {
    this.pendingItems.update(items => 
      items.map(item => item.id === id ? { ...item, status } : item)
    );
  }
}
