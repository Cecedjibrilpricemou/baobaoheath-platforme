// features/medecin/dossier — le dossier de la visite, vu par le médecin.
//
// Bloc 2 de l'addendum du 2026-09-28 : c'est le médecin qui prescrit les
// analyses, plus l'agent d'accueil. Jusqu'ici le seul écran permettant de le
// faire était celui de l'accueil — côté API le médecin avait déjà le droit,
// c'est l'écran qui manquait.
//
// Le médecin arrive ici depuis ses orientations ou ses résultats à libérer.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import type { DemandeAnalyseView, EpisodeSoinsView, ExamenView, StructureRefView, Urgence } from '@baobaoheath/shared-types';

import { HopitalService } from '../../../core/services/hopital.service';
import { LaboratoireService } from '../../../core/services/laboratoire.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { statutDemandeClasse, statutEpisodeClasse, urgenceClasse } from '../../hopital/hopital.utils';
import { interpretationClasse, referenceLisible } from '../../laboratoire/laboratoire.utils';

@Component({
  selector: 'app-medecin-dossier',
  standalone: true,
  imports: [
    RouterLink, DatePipe, FormsModule,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule,
    TranslatePipe,
  ],
  templateUrl: './dossier.component.html',
  styleUrl: './dossier.component.scss',
})
export class DossierComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private hopital = inject(HopitalService);
  private labo    = inject(LaboratoireService);
  private toastr  = inject(ToastrService);
  private i18n    = inject(I18nService);
  private dialog  = inject(MatDialog);

  readonly statutClasse  = statutEpisodeClasse;
  readonly demandeClasse = statutDemandeClasse;
  readonly urgenceClasse = urgenceClasse;
  readonly lectureClasse = interpretationClasse;
  readonly reference     = referenceLisible;

  episode   = signal<EpisodeSoinsView | null>(null);
  isLoading = signal(true);
  isSaving  = signal(false);
  prescrit  = signal(false);

  readonly termine = computed(() => {
    const s = this.episode()?.statut;
    return s === 'CLOS' || s === 'ANNULE';
  });

  laboratoires = signal<StructureRefView[]>([]);
  examens      = signal<ExamenView[]>([]);

  demande = { idLaboratoire: '', urgence: 'ROUTINE' as Urgence, indicationClinique: '', consignesPatient: '' };
  filtreExamens = signal('');
  selection = signal<Map<string, string>>(new Map());
  readonly urgences: Urgence[] = ['ROUTINE', 'URGENT', 'URGENCE_VITALE'];

  /** Les examens groupés par catégorie : 33 lignes à plat seraient illisibles. */
  readonly examensFiltres = computed(() => {
    const q = this.filtreExamens().trim().toLowerCase();
    const liste = q
      ? this.examens().filter((e) =>
          e.libelle.toLowerCase().includes(q) || e.codeLoinc.includes(q) || e.categorie.toLowerCase().includes(q))
      : this.examens();
    const groupes = new Map<string, ExamenView[]>();
    for (const e of liste) groupes.set(e.categorie, [...(groupes.get(e.categorie) ?? []), e]);
    return [...groupes.entries()].map(([categorie, items]) => ({ categorie, items }));
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.charger(id);
    this.hopital.listerLaboratoires().subscribe({
      next: (r) => {
        this.laboratoires.set(r.data ?? []);
        if (r.data?.[0]) this.demande.idLaboratoire = r.data[0].id;
      },
    });
    this.hopital.listerExamens().subscribe({ next: (r) => this.examens.set(r.data ?? []) });
  }

  private charger(id: string) {
    this.hopital.getEpisode(id).subscribe({
      next: (r) => { this.episode.set(r.data ?? null); this.isLoading.set(false); },
      error: (err) => {
        this.isLoading.set(false);
        this.erreur(err);
        this.router.navigate(['/medecin/orientations']);
      },
    });
  }

  private erreur(err: unknown) {
    const e = err as { status?: number; error?: { error?: string; message?: string } };
    if (e?.status === 0) {
      this.toastr.error(this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE'), this.i18n.t('COMMON.ERROR_TITLE'));
      return;
    }
    this.toastr.error(
      e?.error?.error ?? e?.error?.message ?? this.i18n.t('COMMON.ERROR_GENERIC'),
      this.i18n.t('COMMON.ERROR_TITLE')
    );
  }

  // ── Prescription d'analyses ──────────────────────────────────────
  basculerExamen(e: ExamenView) {
    const s = new Map(this.selection());
    if (s.has(e.id)) s.delete(e.id); else s.set(e.id, '');
    this.selection.set(s);
  }
  examenChoisi(id: string) { return this.selection().has(id); }

  creerDemande() {
    const ep = this.episode();
    if (!ep || this.isSaving() || !this.demande.idLaboratoire || this.selection().size === 0) return;
    this.isSaving.set(true);
    this.hopital.creerDemandeAnalyse(ep.id, {
      idLaboratoire: this.demande.idLaboratoire,
      urgence: this.demande.urgence,
      indicationClinique: this.demande.indicationClinique.trim() || undefined,
      consignesPatient: this.demande.consignesPatient.trim() || undefined,
      examens: [...this.selection().entries()].map(([idExamen, commentaire]) => ({
        idExamen, commentaire: commentaire.trim() || undefined,
      })),
    }).subscribe({
      next: (r) => {
        this.isSaving.set(false);
        this.toastr.success(
          this.i18n.t('HOPITAL.DETAIL.DA_SUCCESS', { numero: r.data?.numero ?? '' }),
          this.i18n.t('COMMON.SUCCESS')
        );
        this.selection.set(new Map());
        this.demande.indicationClinique = '';
        this.demande.consignesPatient = '';
        this.demande.urgence = 'ROUTINE';
        this.prescrit.set(false);
        this.charger(ep.id);
      },
      error: (err) => { this.isSaving.set(false); this.erreur(err); },
    });
  }

  // ── Résultats ────────────────────────────────────────────────────
  bonExamen(d: DemandeAnalyseView) { this.hopital.ouvrirBonExamen(d.id); }
  compteRendu(d: DemandeAnalyseView) { this.labo.ouvrirCompteRendu(d.id, 'prescripteur'); }
  aResultats(d: DemandeAnalyseView) { return d.lignes.some((l) => l.resultat); }

  /** Validés par le laboratoire mais que le patient ne voit pas encore. */
  aLiberer(d: DemandeAnalyseView) { return d.statut === 'VALIDEE' && !d.diffuseePatientLe; }

  // ── Clôture ──────────────────────────────────────────────────────
  // Depuis l'addendum, c'est le médecin qui ferme l'épisode : lui seul sait
  // quand la prise en charge est finie.
  cloturer() {
    const ep = this.episode();
    if (!ep) return;
    const data: ConfirmDialogData = {
      titre: this.i18n.t('HOPITAL.DETAIL.ACTION_CLOTURER'),
      texte: this.i18n.t('MEDECIN.DOSSIER.CLOTURER_CONFIRM'),
      confirmer: this.i18n.t('COMMON.CONFIRM'),
      annuler: this.i18n.t('COMMON.CANCEL'),
      icone: 'pi-lock',
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '400px', autoFocus: false })
      .afterClosed().subscribe((ok) => {
        if (!ok) return;
        this.hopital.cloturerEpisode(ep.id).subscribe({
          next: (r) => {
            this.episode.set(r.data ?? ep);
            this.toastr.success(this.i18n.t('HOPITAL.DETAIL.EPISODE_CLOS'), this.i18n.t('COMMON.SUCCESS'));
          },
          error: (err) => this.erreur(err),
        });
      });
  }

  age(dateNaissance: string | Date): number | null {
    const n = new Date(dateNaissance);
    if (Number.isNaN(n.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - n.getFullYear();
    if (now < new Date(now.getFullYear(), n.getMonth(), n.getDate())) a -= 1;
    return a;
  }
}
