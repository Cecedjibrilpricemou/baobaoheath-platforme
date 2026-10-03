// features/admin/comptes/comptes.component.ts
//
// Suspendre et reactiver un compte (EF-12-01).
//
// Une suspension coupe un soignant de ses patients. L'ecran est donc ecrit
// pour qu'on ne la declenche pas par inadvertance :
//
//   - le motif est saisi dans une boite de confirmation, pas d'un seul clic ;
//   - le bouton reste inactif tant que le motif ne fait pas dix caracteres,
//     et l'ecran dit pourquoi ;
//   - la reponse annonce **ce qui a reellement ete coupe**, sessions et
//     connexions temps reel comprises.
//
// Tous les champs sont des signaux : l'application est zoneless.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { CompteView, Role } from '@baobaoheath/shared-types';
import { AdminService } from '../../../core/services/admin.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const ROLES: Role[] = [
  'PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'AGENT_ACCUEIL',
  'TECHNICIEN_LABO', 'LIVREUR', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL',
  'ADMIN_NATIONAL', 'SUPER_ADMIN',
];

/** La longueur minimale du motif, la meme que l'API et la contrainte SQL. */
const MOTIF_MIN = 10;

@Component({
  selector: 'app-comptes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './comptes.component.html',
  styleUrl: './comptes.component.scss',
})
export class ComptesComponent implements OnInit {
  private admin = inject(AdminService);
  private i18n = inject(I18nService);

  roles = ROLES;
  motifMin = MOTIF_MIN;

  // ── Les criteres ───────────────────────────────────────────────────
  q = signal('');
  role = signal<Role | ''>('');
  etat = signal<'tous' | 'actifs' | 'fermes'>('tous');

  // ── L'etat ─────────────────────────────────────────────────────────
  comptes = signal<CompteView[]>([]);
  total = signal(0);
  chargement = signal(true);
  erreur = signal('');
  succes = signal('');

  // ── La boite de confirmation ───────────────────────────────────────
  cible = signal<CompteView | null>(null);
  motif = signal('');
  enCours = signal(false);

  motifValide = computed(() => this.motif().trim().length >= MOTIF_MIN);

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.rechercher();
  }

  rechercher() {
    this.chargement.set(true);
    this.erreur.set('');
    this.admin.rechercherComptes({
      q: this.q().trim() || undefined,
      role: (this.role() || undefined) as Role | undefined,
      actifs: this.etat() === 'tous' ? undefined : this.etat() === 'actifs',
      limit: 50,
    }).subscribe({
      next: (res) => {
        this.comptes.set(res.data?.comptes ?? []);
        this.total.set(res.data?.total ?? 0);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.COMPTES.ERR_RECHERCHE'));
      },
    });
  }

  /** Ouvre la boite : on ne suspend pas d'un seul clic. */
  demanderSuspension(compte: CompteView) {
    this.cible.set(compte);
    this.motif.set('');
    this.erreur.set('');
  }

  annuler() {
    this.cible.set(null);
    this.motif.set('');
  }

  confirmerSuspension() {
    const compte = this.cible();
    if (!compte || !this.motifValide()) return;

    this.enCours.set(true);
    this.erreur.set('');
    this.admin.suspendreCompte(compte.id, this.motif().trim()).subscribe({
      next: (res) => {
        this.enCours.set(false);
        this.cible.set(null);
        // On annonce ce qui a ete coupe, pas un simple « fait » : c'est ce qui
        // rend la mesure verifiable.
        const d = res.data;
        this.succes.set(this.i18n.t('ADMIN.COMPTES.SUSPENDU', {
          nom: d?.nomComplet ?? '',
          sessions: d?.sessionsFermees ?? 0,
          sockets: d?.socketsFermes ?? 0,
        }));
        setTimeout(() => this.succes.set(''), 8000);
        this.rechercher();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.COMPTES.ERR_SUSPENSION'));
      },
    });
  }

  reactiver(compte: CompteView) {
    this.enCours.set(true);
    this.erreur.set('');
    this.admin.reactiverCompte(compte.id).subscribe({
      next: () => {
        this.enCours.set(false);
        this.succes.set(this.i18n.t('ADMIN.COMPTES.REACTIVE', {
          nom: `${compte.prenom} ${compte.nom}`,
        }));
        setTimeout(() => this.succes.set(''), 5000);
        this.rechercher();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.COMPTES.ERR_REACTIVATION'));
      },
    });
  }

  private messageDe(err: unknown, cleDefaut: string): string {
    const e = err as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t(cleDefaut);
  }
}
