// features/hopital/admission — recherche obligatoire du patient (EF-03-01)
// puis ouverture d'un episode de soins (EF-03-02).
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import type { PatientRechercheView } from '@baobaoheath/shared-types';
import { HopitalService, MedecinRefView } from '../../../core/services/hopital.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

@Component({
  selector: 'app-hopital-admission',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  templateUrl: './admission.component.html',
})
export class AdmissionComponent implements OnInit {
  private hopital = inject(HopitalService);
  private router  = inject(Router);
  private toastr  = inject(ToastrService);
  private i18n    = inject(I18nService);

  recherche  = '';
  resultats  = signal<PatientRechercheView[]>([]);
  isSearching = signal(false);
  aCherche   = signal(false);

  medecins  = signal<MedecinRefView[]>([]);
  selection = signal<PatientRechercheView | null>(null);
  isSaving  = signal(false);

  formulaire = { motif: '', service: '', idResponsable: '', notes: '' };

  private terme$ = new Subject<string>();

  ngOnInit() {
    this.hopital.listerMedecins().subscribe({ next: (r) => this.medecins.set(r.data ?? []) });

    this.terme$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 3) { this.resultats.set([]); this.aCherche.set(false); return of(null); }
        this.isSearching.set(true);
        return this.hopital.rechercherPatients(q.trim()).pipe(catchError(() => of({ success: false, data: [] as PatientRechercheView[] })));
      }),
    ).subscribe((r) => {
      if (!r) return;
      this.resultats.set(r.data ?? []);
      this.isSearching.set(false);
      this.aCherche.set(true);
    });
  }

  onRecherche(valeur: string) {
    this.recherche = valeur;
    this.terme$.next(valeur);
  }

  choisir(p: PatientRechercheView) {
    this.selection.set(p);
    this.formulaire = { motif: '', service: '', idResponsable: '', notes: '' };
  }

  annuler() { this.selection.set(null); }

  ouvrir() {
    const p = this.selection();
    if (!p || this.isSaving() || this.formulaire.motif.trim().length < 3) return;
    this.isSaving.set(true);
    this.hopital.creerEpisode({
      idPatient: p.id,
      motif: this.formulaire.motif.trim(),
      service: this.formulaire.service.trim() || undefined,
      idResponsable: this.formulaire.idResponsable || undefined,
      notes: this.formulaire.notes.trim() || undefined,
    }).subscribe({
      next: (r) => {
        this.isSaving.set(false);
        this.toastr.success(this.i18n.t('HOPITAL.ADMISSION.SUCCESS', { numero: r.data?.numero ?? '' }), this.i18n.t('COMMON.SUCCESS'));
        if (r.data) this.router.navigate(['/hopital/episodes', r.data.id]);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.error ?? this.i18n.t('COMMON.ERROR_GENERIC'), this.i18n.t('COMMON.ERROR_TITLE'));
      },
    });
  }

  initiales(p: PatientRechercheView): string {
    return `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();
  }
}
