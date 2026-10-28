// L'encadrement de la plateforme, recrute par le super administrateur seul.
//
// **Ces deux roles n'etaient creables par personne.** `ADMIN_REGIONAL` et
// `ADMIN_NATIONAL` existaient dans les gardes et dans les menus, mais aucun
// ecran ni aucun schema ne les acceptait : hors du jeu de donnees initial, un
// unique super administrateur portait toute la plateforme.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import type {
  AdministrateurView,
  CreationAdministrateurView,
  CreerAdministrateurDto,
} from '@baobaoheath/shared-types';
import { AdministrateurAdminService } from '../../../core/services/administrateur-admin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

type RoleEncadrement = CreerAdministrateurDto['role'];

@Component({
  selector: 'app-admin-administrateurs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './administrateurs.component.html',
  styleUrl: './administrateurs.component.scss',
})
export class AdministrateursComponent implements OnInit {
  private readonly service = inject(AdministrateurAdminService);
  private readonly i18n = inject(I18nService);

  readonly administrateurs = signal<AdministrateurView[]>([]);
  readonly chargement = signal(true);
  readonly creationEnCours = signal(false);
  readonly erreur = signal('');
  readonly succes = signal('');
  readonly creation = signal<CreationAdministrateurView | null>(null);

  readonly roles: RoleEncadrement[] = ['ADMIN_REGIONAL', 'ADMIN_NATIONAL'];

  readonly formulaire = signal<CreerAdministrateurDto>({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    role: 'ADMIN_REGIONAL',
  });

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.service.lister().subscribe({
      next: (response) => {
        this.administrateurs.set(response.data ?? []);
        this.chargement.set(false);
      },
      error: (error: unknown) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(error, 'ADMIN.ADMINISTRATEURS.ERR_CHARGEMENT'));
      },
    });
  }

  modifier(champ: keyof CreerAdministrateurDto, valeur: string): void {
    this.formulaire.update((form) => ({ ...form, [champ]: valeur }));
  }

  libelleRole(role: string): string {
    return this.i18n.t(`ADMIN.ADMINISTRATEURS.ROLE_${role}`);
  }

  peutCreer(): boolean {
    const f = this.formulaire();
    return [f.prenom, f.nom, f.telephone, f.email].every((v) => v.trim().length > 0)
      && !this.creationEnCours();
  }

  creer(): void {
    if (!this.peutCreer()) return;
    this.creationEnCours.set(true);
    this.erreur.set('');
    this.succes.set('');
    this.creation.set(null);
    const form = this.formulaire();
    const dto: CreerAdministrateurDto = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      role: form.role,
    };
    this.service.creer(dto).subscribe({
      next: (response) => {
        this.creationEnCours.set(false);
        const data = response.data;
        if (!data) {
          this.erreur.set(this.i18n.t('ADMIN.ADMINISTRATEURS.ERR_CREATION'));
          return;
        }
        this.creation.set(data);
        this.succes.set(this.i18n.t('ADMIN.ADMINISTRATEURS.SUCCES_CREATION', {
          nom: `${data.administrateur.prenom} ${data.administrateur.nom}`,
        }));
        this.formulaire.set({ prenom: '', nom: '', telephone: '', email: '', role: 'ADMIN_REGIONAL' });
        this.charger();
      },
      error: (error: unknown) => {
        this.creationEnCours.set(false);
        this.erreur.set(this.messageDe(error, 'ADMIN.ADMINISTRATEURS.ERR_CREATION'));
      },
    });
  }

  /** Le mot de passe ne s'affiche qu'une fois : on le copie, ou on le perd. */
  copierMotDePasse(): void {
    const mot = this.creation()?.motDePasseTemporaire;
    if (!mot) return;
    void navigator.clipboard?.writeText(mot).then(
      () => this.succes.set(this.i18n.t('ADMIN.ADMINISTRATEURS.MDP_COPIE')),
      () => undefined,
    );
  }

  ignorerMotDePasse(): void {
    this.creation.set(null);
  }

  private messageDe(error: unknown, cleDefaut: string): string {
    const e = error as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t(cleDefaut);
  }
}
