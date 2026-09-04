// shared/components/avatar/avatar.component.ts
// Affiche la photo de profil d'un utilisateur, ou ses initiales à défaut.
// Hérite entièrement de la taille/forme/couleur définies par la classe CSS
// posée sur <app-avatar> par l'appelant (ex: class="bb-sidebar__avatar").
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss'
})
export class AvatarComponent {
  photoUrl = input<string | null | undefined>(null);
  initiales = input<string>('');
}
