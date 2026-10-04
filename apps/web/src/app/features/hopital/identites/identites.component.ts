// features/hopital/identites/identites.component.ts
//
// Vérifier l'identité d'un patient au comptoir (EF-01-04/10).
//
// **L'écran dit ce que la vérification ouvre, et ce qu'elle n'ouvre pas.**
// Elle ouvre le tiers payant. Elle ne conditionne pas les soins : un patient
// à l'identité provisoire est consulté, suivi et prescrit normalement. Sans
// cette phrase, un agent finirait par croire qu'il doit refuser quelqu'un
// sans papiers — et ce serait une faute grave.
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  IdentitePatientView, NiveauIdentite, TypePieceIdentite,
} from '@baobaoheath/shared-types';
import { HopitalService } from '../../../core/services/hopital.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const PIECES: TypePieceIdentite[] = [
  'CARTE_NATIONALE', 'PASSEPORT', 'ACTE_NAISSANCE', 'CARTE_CONSULAIRE', 'PERMIS_CONDUIRE', 'AUTRE',
];

/** Les mêmes longueurs que l'API et la contrainte SQL. */
const NUMERO_MIN = 3;
const LIEU_MIN = 2;

@Component({
  selector: 'app-identites',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressSpinnerModule,
  ],
  templateUrl: './identites.component.html',
  styleUrl: './identites.component.scss',
})
export class IdentitesComponent implements OnInit {
  private hopital = inject(HopitalService);
  private i18n = inject(I18nService);

  pieces = PIECES;
  numeroMin = NUMERO_MIN;

  // ── Les critères ───────────────────────────────────────────────────
  q = signal('');
  niveau = signal<NiveauIdentite | ''>('PROVISOIRE');

  // ── L'état ─────────────────────────────────────────────────────────
  patients = signal<IdentitePatientView[]>([]);
  chargement = signal(true);
  erreur = signal('');
  succes = signal('');

  // ── La boîte de vérification ───────────────────────────────────────
  cible = signal<IdentitePatientView | null>(null);
  typePiece = signal<TypePieceIdentite | ''>('');
  numeroPiece = signal('');
  lieuNaissance = signal('');
  nomMere = signal('');
  remplacerPiece = signal(false);
  enCours = signal(false);

  /** Revérifier n'est pas une erreur — une pièce se renouvelle — mais c'est un geste conscient. */
  dejaVerifiee = computed(() => this.cible()?.niveauIdentite === 'VERIFIEE');

  peutVerifier = computed(() => {
    if (!this.typePiece() || this.enCours()) return false;
    if (this.numeroPiece().trim().length < NUMERO_MIN) return false;
    if (this.lieuNaissance().trim().length < LIEU_MIN) return false;
    return !this.dejaVerifiee() || this.remplacerPiece();
  });

  provisoires = computed(() => this.patients().filter((p) => p.niveauIdentite === 'PROVISOIRE').length);

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.chargement.set(true);
    this.erreur.set('');
    this.hopital.identites({
      q: this.q().trim() || undefined,
      niveau: this.niveau() || undefined,
    }).subscribe({
      next: (res) => {
        this.patients.set(res.data ?? []);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageDe(err, 'HOPITAL.IDENTITES.ERR_CHARGEMENT'));
      },
    });
  }

  ouvrir(p: IdentitePatientView) {
    this.cible.set(p);
    this.typePiece.set('');
    this.numeroPiece.set('');
    // Les traits déjà connus sont pré-remplis : l'agent n'a pas à les
    // redemander au patient, qui les a peut-être donnés la semaine dernière.
    this.lieuNaissance.set(p.lieuNaissance ?? '');
    this.nomMere.set(p.nomMere ?? '');
    this.remplacerPiece.set(false);
    this.erreur.set('');
  }

  annuler() {
    this.cible.set(null);
  }

  confirmer() {
    const p = this.cible();
    if (!p || !this.peutVerifier()) return;

    this.enCours.set(true);
    this.erreur.set('');
    this.hopital.verifierIdentite(p.id, {
      typePiece: this.typePiece() as TypePieceIdentite,
      numeroPiece: this.numeroPiece().trim(),
      lieuNaissance: this.lieuNaissance().trim(),
      nomMere: this.nomMere().trim() || undefined,
      remplacerPiece: this.remplacerPiece() || undefined,
    }).subscribe({
      next: (res) => {
        this.enCours.set(false);
        this.cible.set(null);
        this.succes.set(this.i18n.t('HOPITAL.IDENTITES.VERIFIEE_MSG', {
          nom: res.data?.nomComplet ?? '',
        }));
        setTimeout(() => this.succes.set(''), 8000);
        this.charger();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(this.messageDe(err, 'HOPITAL.IDENTITES.ERR_VERIFICATION'));
      },
    });
  }

  private messageDe(err: unknown, cleDefaut: string): string {
    const e = err as { error?: { error?: string; message?: string } };
    return e?.error?.error ?? e?.error?.message ?? this.i18n.t(cleDefaut);
  }
}
