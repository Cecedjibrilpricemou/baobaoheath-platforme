// features/admin/demandes-rgpd/demandes-rgpd.component.ts
//
// Traiter les demandes d'exercice de droits (EF-12-09).
//
// L'écran est fait pour qu'on ne close pas une demande à la légère :
//
//   - la réponse est saisie dans une boîte, jamais d'un clic ;
//   - le bouton reste inactif tant qu'elle ne fait pas dix caractères, et
//     l'écran dit pourquoi : un refus qu'on ne motive pas n'est pas
//     contestable ;
//   - pour une demande d'effacement, un rappel s'affiche — un dossier de
//     soins ne se supprime pas, il s'anonymise. C'est la réponse qui engage
//     la plateforme vis-à-vis du patient.
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
import type {
  DemandeRgpdView, StatutDemandeRgpd, TypeDemandeRgpd,
} from '@baobaoheath/shared-types';
import { AdminService } from '../../../core/services/admin.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const TYPES: TypeDemandeRgpd[] = [
  'ACCES', 'RECTIFICATION', 'EFFACEMENT', 'PORTABILITE', 'OPPOSITION', 'LIMITATION',
];
const STATUTS: StatutDemandeRgpd[] = ['RECUE', 'EN_COURS', 'SATISFAITE', 'REFUSEE'];

/** La même longueur que l'API et la contrainte SQL. */
const REPONSE_MIN = 10;

@Component({
  selector: 'app-demandes-rgpd',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './demandes-rgpd.component.html',
  styleUrl: './demandes-rgpd.component.scss',
})
export class DemandesRgpdComponent implements OnInit {
  private admin = inject(AdminService);
  private i18n = inject(I18nService);

  types = TYPES;
  statuts = STATUTS;
  reponseMin = REPONSE_MIN;

  // ── Les critères ───────────────────────────────────────────────────
  statut = signal<StatutDemandeRgpd | ''>('');
  type = signal<TypeDemandeRgpd | ''>('');

  // ── L'état ─────────────────────────────────────────────────────────
  demandes = signal<DemandeRgpdView[]>([]);
  ouvertes = signal(0);
  enRetard = signal(0);
  delaiJours = signal(30);
  chargement = signal(true);
  erreur = signal('');
  succes = signal('');

  // ── La boîte de réponse ────────────────────────────────────────────
  cible = signal<DemandeRgpdView | null>(null);
  reponse = signal('');
  satisfaite = signal(true);
  enCours = signal(false);

  reponseValide = computed(() => this.reponse().trim().length >= REPONSE_MIN);

  /** Un effacement appelle un rappel : ce n'est pas une suppression. */
  rappelEffacement = computed(() => this.cible()?.type === 'EFFACEMENT');

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.chargement.set(true);
    this.erreur.set('');
    this.admin.demandesRgpd({
      statut: this.statut() || undefined,
      type: this.type() || undefined,
    }).subscribe({
      next: (res) => {
        this.demandes.set(res.data?.demandes ?? []);
        this.ouvertes.set(res.data?.ouvertes ?? 0);
        this.enRetard.set(res.data?.enRetard ?? 0);
        this.delaiJours.set(res.data?.delaiJours ?? 30);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.RGPD.ERR_CHARGEMENT'));
      },
    });
  }

  prendreEnCharge(d: DemandeRgpdView) {
    this.enCours.set(true);
    this.erreur.set('');
    this.admin.prendreEnChargeDemande(d.id).subscribe({
      next: () => {
        this.enCours.set(false);
        this.charger();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.RGPD.ERR_PRISE'));
      },
    });
  }

  /** Ouvre la boîte : on ne close pas une demande d'un clic. */
  ouvrirReponse(d: DemandeRgpdView, satisfaite: boolean) {
    this.cible.set(d);
    this.satisfaite.set(satisfaite);
    this.reponse.set('');
    this.erreur.set('');
  }

  annuler() {
    this.cible.set(null);
    this.reponse.set('');
  }

  confirmerReponse() {
    const d = this.cible();
    if (!d || !this.reponseValide()) return;

    this.enCours.set(true);
    this.erreur.set('');
    this.admin.repondreDemande(d.id, this.satisfaite(), this.reponse().trim()).subscribe({
      next: (res) => {
        this.enCours.set(false);
        this.cible.set(null);
        this.succes.set(this.i18n.t(
          res.data?.statut === 'SATISFAITE' ? 'ADMIN.RGPD.SATISFAITE' : 'ADMIN.RGPD.REFUSEE',
          { demandeur: d.demandeur }
        ));
        setTimeout(() => this.succes.set(''), 6000);
        this.charger();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'ADMIN.RGPD.ERR_REPONSE'));
      },
    });
  }

  private messageDe(err: unknown, cleDefaut: string): string {
    const e = err as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t(cleDefaut);
  }
}
