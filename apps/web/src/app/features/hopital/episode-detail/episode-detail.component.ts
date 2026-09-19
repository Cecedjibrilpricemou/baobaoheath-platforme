// features/hopital/episode-detail — un episode : orientation (EF-03-05),
// demandes d'analyse (EF-03-03/04/06), cloture.
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
import { HopitalService, MedecinRefView } from '../../../core/services/hopital.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { dateLocaleParDefaut, statutDemandeClasse, statutEpisodeClasse, urgenceClasse } from '../hopital.utils';

type Panneau = 'aucun' | 'orientation' | 'analyse';

@Component({
  selector: 'app-hopital-episode-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule, TranslatePipe],
  templateUrl: './episode-detail.component.html',
})
export class EpisodeDetailComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private hopital = inject(HopitalService);
  private toastr  = inject(ToastrService);
  private i18n    = inject(I18nService);
  private dialog  = inject(MatDialog);

  readonly statutClasse = statutEpisodeClasse;
  readonly demandeClasse = statutDemandeClasse;
  readonly urgenceClasse = urgenceClasse;

  episode   = signal<EpisodeSoinsView | null>(null);
  isLoading = signal(true);
  isSaving  = signal(false);
  panneau   = signal<Panneau>('aucun');

  readonly termine = computed(() => { const s = this.episode()?.statut; return s === 'CLOS' || s === 'ANNULE'; });

  // Referentiels (charges une fois)
  medecins     = signal<MedecinRefView[]>([]);
  laboratoires = signal<StructureRefView[]>([]);
  examens      = signal<ExamenView[]>([]);

  // Orientation
  orientation = { idMedecin: '', service: '', avecRdv: true, prevuLe: dateLocaleParDefaut(), motif: '' };

  // Demande d'analyse
  demande = { idLaboratoire: '', urgence: 'ROUTINE' as Urgence, indicationClinique: '', consignesPatient: '' };
  filtreExamens = signal('');
  selection = signal<Map<string, string>>(new Map()); // idExamen -> commentaire
  readonly examensFiltres = computed(() => {
    const q = this.filtreExamens().trim().toLowerCase();
    const liste = q ? this.examens().filter((e) => e.libelle.toLowerCase().includes(q) || e.codeLoinc.includes(q) || e.categorie.toLowerCase().includes(q)) : this.examens();
    const groupes = new Map<string, ExamenView[]>();
    for (const e of liste) groupes.set(e.categorie, [...(groupes.get(e.categorie) ?? []), e]);
    return [...groupes.entries()].map(([categorie, items]) => ({ categorie, items }));
  });
  readonly urgences: Urgence[] = ['ROUTINE', 'URGENT', 'URGENCE_VITALE'];

  // Annulation d'une demande
  demandeAAnnuler = signal<DemandeAnalyseView | null>(null);
  motifAnnulation = '';

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.charger(id);
    this.hopital.listerMedecins().subscribe({ next: (r) => this.medecins.set(r.data ?? []) });
    this.hopital.listerLaboratoires().subscribe({ next: (r) => { this.laboratoires.set(r.data ?? []); if (r.data?.[0]) this.demande.idLaboratoire = r.data[0].id; } });
    this.hopital.listerExamens().subscribe({ next: (r) => this.examens.set(r.data ?? []) });
  }

  private charger(id: string) {
    this.hopital.getEpisode(id).subscribe({
      next: (r) => { this.episode.set(r.data ?? null); this.isLoading.set(false); },
      error: (err) => { this.isLoading.set(false); this.erreur(err); this.router.navigate(['/hopital/episodes']); },
    });
  }

  private erreur(err: unknown) {
    const e = err as { error?: { error?: string } };
    this.toastr.error(e?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'), this.i18n.t('COMMON.ERROR_TITLE'));
  }

  ouvrir(p: Panneau) { this.panneau.set(this.panneau() === p ? 'aucun' : p); }

  // ── Orientation ────────────────────────────────────────────────
  orienter() {
    const ep = this.episode();
    if (!ep || this.isSaving()) return;
    const o = this.orientation;
    if (!o.idMedecin && !o.service.trim()) return;
    this.isSaving.set(true);
    this.hopital.orienter(ep.id, {
      idMedecin: o.idMedecin || undefined,
      service: o.service.trim() || undefined,
      prevuLe: o.avecRdv && o.idMedecin ? new Date(o.prevuLe).toISOString() : undefined,
      motif: o.motif.trim() || undefined,
    }).subscribe({
      next: (r) => { this.isSaving.set(false); this.episode.set(r.data ?? ep); this.panneau.set('aucun'); this.toastr.success(this.i18n.t('HOPITAL.DETAIL.ORIENT_SUCCESS'), this.i18n.t('COMMON.SUCCESS')); },
      error: (err) => { this.isSaving.set(false); this.erreur(err); },
    });
  }

  // ── Demande d'analyse ──────────────────────────────────────────
  basculerExamen(e: ExamenView) {
    const s = new Map(this.selection());
    if (s.has(e.id)) s.delete(e.id); else s.set(e.id, '');
    this.selection.set(s);
  }
  commenterExamen(id: string, commentaire: string) {
    const s = new Map(this.selection()); s.set(id, commentaire); this.selection.set(s);
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
      examens: [...this.selection().entries()].map(([idExamen, commentaire]) => ({ idExamen, commentaire: commentaire.trim() || undefined })),
    }).subscribe({
      next: (r) => {
        this.isSaving.set(false);
        this.toastr.success(this.i18n.t('HOPITAL.DETAIL.DA_SUCCESS', { numero: r.data?.numero ?? '' }), this.i18n.t('COMMON.SUCCESS'));
        this.selection.set(new Map()); this.demande.indicationClinique = ''; this.demande.consignesPatient = ''; this.demande.urgence = 'ROUTINE';
        this.panneau.set('aucun');
        this.charger(ep.id);
      },
      error: (err) => { this.isSaving.set(false); this.erreur(err); },
    });
  }

  bonExamen(d: DemandeAnalyseView) { this.hopital.ouvrirBonExamen(d.id); }
  peutAnnulerDemande(d: DemandeAnalyseView) { return d.statut === 'TRANSMISE' || d.statut === 'RECUE'; }

  confirmerAnnulationDemande() {
    const d = this.demandeAAnnuler(); const ep = this.episode();
    if (!d || !ep || this.motifAnnulation.trim().length < 3 || this.isSaving()) return;
    this.isSaving.set(true);
    this.hopital.annulerDemande(d.id, this.motifAnnulation.trim()).subscribe({
      next: () => { this.isSaving.set(false); this.demandeAAnnuler.set(null); this.motifAnnulation = ''; this.toastr.success(this.i18n.t('HOPITAL.DETAIL.DEMANDE_ANNULEE'), this.i18n.t('COMMON.SUCCESS')); this.charger(ep.id); },
      error: (err) => { this.isSaving.set(false); this.erreur(err); },
    });
  }

  // ── Cloture / annulation ───────────────────────────────────────
  cloturer(annuler: boolean) {
    const ep = this.episode();
    if (!ep) return;
    const data: ConfirmDialogData = {
      titre: this.i18n.t(annuler ? 'HOPITAL.DETAIL.ACTION_ANNULER' : 'HOPITAL.DETAIL.ACTION_CLOTURER'),
      texte: this.i18n.t(annuler ? 'HOPITAL.DETAIL.ANNULER_CONFIRM' : 'HOPITAL.DETAIL.CLOTURER_CONFIRM'),
      confirmer: this.i18n.t('COMMON.CONFIRM'),
      annuler: this.i18n.t('COMMON.CANCEL'),
      icone: annuler ? 'pi-times-circle' : 'pi-lock',
      danger: annuler,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '400px', autoFocus: false }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      const appel = annuler ? this.hopital.annulerEpisode(ep.id) : this.hopital.cloturerEpisode(ep.id);
      appel.subscribe({
        next: (r) => { this.episode.set(r.data ?? ep); this.toastr.success(this.i18n.t(annuler ? 'HOPITAL.DETAIL.EPISODE_ANNULE' : 'HOPITAL.DETAIL.EPISODE_CLOS'), this.i18n.t('COMMON.SUCCESS')); },
        error: (err) => this.erreur(err),
      });
    });
  }

  initiales(ep: EpisodeSoinsView): string {
    return `${ep.patient.prenom.charAt(0)}${ep.patient.nom.charAt(0)}`.toUpperCase();
  }
}
