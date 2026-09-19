import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlateformeService } from '../../../../shared/services/plateforme.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  readonly plateforme = inject(PlateformeService);

  formulaire = { nom: '', email: '', sujet: '', message: '' };

  // Pas d'API de contact (un point d'entree public serait une cible a spam) :
  // le formulaire ouvre le client mail avec le message pre-rempli.
  envoyer() {
    const { nom, email, sujet, message } = this.formulaire;
    const corps = [message.trim(), '', '—', nom.trim(), email.trim()].join('\n');
    const url = `mailto:${this.plateforme.emailContact()}?subject=${encodeURIComponent(sujet.trim() || `Contact ${this.plateforme.nom()}`)}&body=${encodeURIComponent(corps)}`;
    window.location.href = url;
  }

  get peutEnvoyer(): boolean {
    return this.formulaire.message.trim().length > 0 && this.plateforme.emailContact().length > 0;
  }
}
