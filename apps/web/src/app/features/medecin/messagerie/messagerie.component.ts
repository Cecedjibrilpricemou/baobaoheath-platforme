// features/medecin/messagerie/messagerie.component.ts
import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewChecked, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MedecinService } from '../../../core/services/medecin.service';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

interface Utilisateur {
  id?: string;
  prenom: string;
  nom: string;
  photoUrl?: string;
  role?: string;
}

interface Message {
  id: string;
  contenu: string;
  envoyeLe: string;
  lu: boolean;
  idExpediteur: string;
  idDestinataire: string;
  expediteur: Utilisateur;
  destinataire: Utilisateur;
}

interface Conversation {
  utilisateur: Utilisateur & { id: string };
  messages: Message[];
  nonLus: number;
  dernierMessage?: Message;
}

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SkeletonModule, TranslatePipe],
  templateUrl: './messagerie.component.html',
  styleUrl: './messagerie.component.scss'
})
export class MessagerieComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private medecinService = inject(MedecinService);
  private authService    = inject(AuthService);
  private socketService  = inject(SocketService);
  private i18n           = inject(I18nService);
  private destroyRef      = inject(DestroyRef);

  currentUser     = this.authService.currentUser;
  messages        = signal<Message[]>([]);
  conversations   = signal<Conversation[]>([]);
  selectedConv    = signal<Conversation | null>(null);
  isLoading       = signal(true);
  isSending       = signal(false);
  newMessage      = '';
  private shouldScroll = false;

  ngOnInit() {
    this.loadMessages();
    this.socketService.on<Message>('message:new')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => this.handleIncomingMessage(msg));
  }

  private handleIncomingMessage(msg: Message) {
    const userId = this.currentUser()?.id;
    // The server only ever emits to the recipient's own room, but a stale
    // socket surviving a user switch (rare, but cheap to guard) shouldn't
    // attribute someone else's message to the wrong conversation.
    if (msg.idDestinataire !== userId) return;

    const interlocuteurId = msg.idExpediteur;
    const isConvOuverte = this.selectedConv()?.utilisateur?.id === interlocuteurId;

    this.conversations.update((convs) => {
      const existing = convs.find((c) => c.utilisateur.id === interlocuteurId);
      const updated: Conversation = existing
        ? {
            ...existing,
            messages: [...existing.messages, msg],
            dernierMessage: msg,
            nonLus: isConvOuverte ? existing.nonLus : existing.nonLus + 1,
          }
        : {
            utilisateur: { ...msg.expediteur, id: interlocuteurId },
            messages: [msg],
            dernierMessage: msg,
            nonLus: isConvOuverte ? 0 : 1,
          };

      const rest = convs.filter((c) => c.utilisateur.id !== interlocuteurId);
      return [updated, ...rest];
    });

    if (isConvOuverte) {
      this.selectedConv.set(this.conversations().find((c) => c.utilisateur.id === interlocuteurId) ?? null);
      this.shouldScroll = true;
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private loadMessages() {
    this.isLoading.set(true);
    this.medecinService.getMessages().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as Message[];
          this.messages.set(data);
          this.buildConversations(data);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  private buildConversations(messages: Message[]) {
    const userId = this.currentUser()?.id;
    const map = new Map<string, Conversation>();

    messages.forEach(m => {
      // Déterminer l'interlocuteur
      const isEnvoye = m.idExpediteur === userId;
      const interlocuteur = isEnvoye
        ? { ...m.destinataire, id: m.idDestinataire }
        : { ...m.expediteur, id: m.idExpediteur };

      if (!map.has(interlocuteur.id)) {
        map.set(interlocuteur.id, {
          utilisateur: interlocuteur as Utilisateur & { id: string },
          messages: [],
          nonLus: 0
        });
      }

      const conv = map.get(interlocuteur.id)!;
      conv.messages.push(m);
      if (!m.lu && !isEnvoye) conv.nonLus++;
    });

    // Trier messages de chaque conversation par date et extraire le dernier
    const convs = Array.from(map.values()).map(conv => {
      conv.messages.sort((a, b) => new Date(a.envoyeLe).getTime() - new Date(b.envoyeLe).getTime());
      conv.dernierMessage = conv.messages[conv.messages.length - 1];
      return conv;
    });

    // Trier conversations par date du dernier message
    convs.sort((a, b) => {
      const da = new Date(a.dernierMessage?.envoyeLe ?? 0).getTime();
      const db = new Date(b.dernierMessage?.envoyeLe ?? 0).getTime();
      return db - da;
    });

    this.conversations.set(convs);
  }

  selectionnerConv(conv: Conversation) {
    this.selectedConv.set(conv);
    this.newMessage = '';
    this.shouldScroll = true;
  }

  estEnvoye(m: Message): boolean {
    return m.idExpediteur === this.currentUser()?.id;
  }

  envoyerMessage() {
    const conv = this.selectedConv();
    if (!conv || !this.newMessage.trim()) return;

    this.isSending.set(true);
    this.medecinService.sendMessage({
      idDestinataire: conv.utilisateur.id,
      contenu: this.newMessage.trim()
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const msg = response.data as Message;
          // Ajouter le message à la conversation
          const updatedConv = {
            ...conv,
            messages: [...conv.messages, msg],
            dernierMessage: msg
          };
          this.selectedConv.set(updatedConv);
          // Mettre à jour la liste
          this.conversations.update(convs =>
            convs.map(c => c.utilisateur.id === conv.utilisateur.id ? updatedConv : c)
          );
        }
        this.newMessage = '';
        this.isSending.set(false);
        this.shouldScroll = true;
      },
      error: () => { this.isSending.set(false); }
    });
  }

  getInitiales(u: Utilisateur): string {
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  getConvAriaLabel(conv: Conversation): string {
    const base = `${conv.utilisateur.prenom} ${conv.utilisateur.nom}`;
    return conv.nonLus > 0
      ? base + this.i18n.t('MEDECIN.MESSAGERIE.UNREAD_SUFFIX_ARIA', { count: conv.nonLus })
      : base;
  }

  formatHeure(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(d: string): string {
    if (!d) return '';
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return this.i18n.t('COMMON.TODAY');
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyerMessage();
    }
  }
}
