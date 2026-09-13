import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/** Adresse affichee dans le bloc contact ; le formulaire y envoie aussi. */
export const CONTACT_EMAIL = 'contact@baobaohealth.org';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  readonly contactEmail = CONTACT_EMAIL;

  formulaire = { nom: '', email: '', sujet: '', message: '' };

  // Pas d'API de contact (un point d'entree public serait une cible a spam) :
  // le formulaire ouvre le client mail avec le message pre-rempli.
  envoyer() {
    const { nom, email, sujet, message } = this.formulaire;
    const corps = [message.trim(), '', '—', nom.trim(), email.trim()].join('\n');
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(sujet.trim() || 'Contact BaoBaoHealth')}&body=${encodeURIComponent(corps)}`;
    window.location.href = url;
  }

  get peutEnvoyer(): boolean {
    return this.formulaire.message.trim().length > 0;
  }
}
