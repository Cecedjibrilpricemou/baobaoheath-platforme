// features/admin/journal/journal.component.ts
//
// Qui a touche au dossier de qui (EF-12-05).
//
// C'est l'ecran le plus sensible du produit : le seul d'ou l'on voit tout.
// Deux consequences visibles ici :
//
//   - **sa consultation est elle-meme journalisee** cote API, et l'ecran le
//     dit a l'operateur plutot que de le lui cacher ;
//   - **un export trop large est refuse, pas tronque.** Le message d'erreur du
//     serveur porte le nombre exact de lignes ; on l'affiche tel quel au lieu
//     d'un « echec de l'export » qui n'apprendrait rien.
//
// Tous les champs sont des signaux : l'application est zoneless, et un
// `[(ngModel)]` sur un champ ordinaire ne previent rien — un formulaire fige
// et un bouton mort, deja payes sur l'ecran de caisse le 2026-10-01.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { FiltreJournalDto, LigneJournalView, Role } from '@baobaoheath/shared-types';
import { AdminService } from '../../../core/services/admin.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Les roles proposes au filtre, dans l'ordre du parcours de soins. */
const ROLES: Role[] = [
  'PATIENT', 'ASC', 'ASC_SUPERVISOR', 'MEDECIN', 'PHARMACIEN', 'AGENT_ACCUEIL',
  'TECHNICIEN_LABO', 'LIVREUR', 'ADMIN_STRUCTURE', 'ADMIN_REGIONAL',
  'ADMIN_NATIONAL', 'SUPER_ADMIN',
];

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressSpinnerModule,
  ],
  templateUrl: './journal.component.html',
  styleUrl: './journal.component.scss',
})
export class JournalComponent implements OnInit {
  private admin = inject(AdminService);
  private i18n = inject(I18nService);

  roles = ROLES;

  // ── Les criteres ───────────────────────────────────────────────────
  du = signal('');
  au = signal('');
  role = signal<Role | ''>('');
  ressource = signal('');
  idPatient = signal('');
  idUtilisateur = signal('');
  echecsSeulement = signal(false);
  parTiers = signal(false);
  page = signal(1);

  // ── L'etat ─────────────────────────────────────────────────────────
  lignes = signal<LigneJournalView[]>([]);
  total = signal(0);
  totalPages = signal(0);
  maxExport = signal(0);
  chargement = signal(true);
  exportEnCours = signal(false);
  erreur = signal('');

  /** `parTiers` n'a de sens qu'avec un patient : tiers de qui, sinon ? */
  parTiersPossible = computed(() => this.idPatient().trim().length > 0);

  /** Prevenir avant de cliquer vaut mieux qu'un refus apres coup. */
  exportTropLarge = computed(() => this.maxExport() > 0 && this.total() > this.maxExport());

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.rechercher();
  }

  rechercher(page = 1) {
    this.page.set(page);
    this.chargement.set(true);
    this.erreur.set('');

    this.admin.rechercherJournal(this.criteres()).subscribe({
      next: (res) => {
        const d = res.data;
        this.lignes.set(d?.lignes ?? []);
        this.total.set(d?.meta?.total ?? 0);
        this.totalPages.set(d?.meta?.totalPages ?? 0);
        this.maxExport.set(d?.maxExport ?? 0);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(err));
      },
    });
  }

  reinitialiser() {
    this.du.set('');
    this.au.set('');
    this.role.set('');
    this.ressource.set('');
    this.idPatient.set('');
    this.idUtilisateur.set('');
    this.echecsSeulement.set(false);
    this.parTiers.set(false);
    this.rechercher();
  }

  exporter() {
    this.exportEnCours.set(true);
    this.erreur.set('');

    this.admin.exporterJournal(this.criteres()).subscribe({
      next: (reponse) => {
        this.exportEnCours.set(false);
        const corps = reponse.body;
        if (!corps) return;
        // Le nom vient du serveur : il porte la date de l'export. Sans
        // `exposedHeaders` cote CORS, cet en-tete arrive a `null` — d'ou le
        // repli, qui ne doit pas servir.
        const entete = reponse.headers.get('Content-Disposition') ?? '';
        const trouve = /filename="([^"]+)"/.exec(entete);
        const nom = trouve?.[1] ?? `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;

        const url = URL.createObjectURL(corps);
        const a = document.createElement('a');
        a.href = url;
        a.download = nom;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: async (err) => {
        this.exportEnCours.set(false);
        // La reponse d'erreur arrive en Blob, puisqu'on a demande un fichier :
        // sans ce decodage, le message du serveur — qui porte le nombre exact
        // de lignes — serait perdu, et l'operateur ne saurait pas de combien
        // resserrer sa recherche.
        this.erreur.set(await this.messageDeBlob(err));
      },
    });
  }

  /** Le libelle d'une ligne, traduit : l'API rend des cles. */
  libelle(l: LigneJournalView): string {
    const objet = l.libelleObjet ? this.i18n.t(l.libelleObjet) : '';
    return this.i18n.t(l.libelle, { objet });
  }

  private criteres(): FiltreJournalDto {
    return {
      du: this.du() || undefined,
      au: this.au() || undefined,
      role: (this.role() || undefined) as Role | undefined,
      ressource: this.ressource().trim() || undefined,
      idPatient: this.idPatient().trim() || undefined,
      idUtilisateur: this.idUtilisateur().trim() || undefined,
      echecsSeulement: this.echecsSeulement() || undefined,
      parTiers: (this.parTiersPossible() && this.parTiers()) || undefined,
      page: this.page(),
      limit: 50,
    };
  }

  private messageDe(err: unknown): string {
    const e = err as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t('ADMIN.JOURNAL.ERR_RECHERCHE');
  }

  private async messageDeBlob(err: unknown): Promise<string> {
    const e = err as { error?: unknown };
    if (e?.error instanceof Blob) {
      try {
        const corps = JSON.parse(await e.error.text()) as { error?: string; message?: string };
        return corps.error ?? corps.message ?? this.i18n.t('ADMIN.JOURNAL.ERR_EXPORT');
      } catch {
        return this.i18n.t('ADMIN.JOURNAL.ERR_EXPORT');
      }
    }
    return this.messageDe(err);
  }
}
