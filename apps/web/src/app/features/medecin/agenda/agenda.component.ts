// features/medecin/agenda — les rendez-vous du médecin, dans l'ordre.
//
// Addendum du 2026-09-28, point 8. Le modèle était déjà indexé pour cette
// requête (`@@index([idMedecin, prevuLe])`) : il ne manquait que l'écran.
//
// Aujourd'hui d'abord, parce que c'est la vue dont il se sert le matin.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import type { RendezVousMedecinView, StatutRendezVous } from '@baobaoheath/shared-types';

import { MedecinService } from '../../../core/services/medecin.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

type Groupe = { cle: string; libelle: string; rdvs: RendezVousMedecinView[] };

@Component({
  selector: 'app-medecin-agenda',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, TranslatePipe],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.scss',
})
export class AgendaComponent implements OnInit {
  private service = inject(MedecinService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  rdvs = signal<RendezVousMedecinView[]>([]);
  isLoading = signal(true);
  enCours = signal<string | null>(null);

  /** Groupés par jour : « aujourd'hui », « demain », puis les dates. */
  readonly groupes = computed<Groupe[]>(() => {
    const parJour = new Map<string, RendezVousMedecinView[]>();
    for (const r of this.rdvs()) {
      const cle = new Date(r.prevuLe).toDateString();
      parJour.set(cle, [...(parJour.get(cle) ?? []), r]);
    }
    return [...parJour.entries()].map(([cle, liste]) => ({
      cle,
      libelle: this.libelleJour(new Date(cle)),
      rdvs: liste,
    }));
  });

  ngOnInit() {
    this.charger();
  }

  private charger() {
    this.isLoading.set(true);
    this.service.getAgenda().subscribe({
      next: (r) => {
        this.rdvs.set(r.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('MEDECIN.AGENDA.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      },
    });
  }

  private libelleJour(d: Date): string {
    const jour = new Date(d); jour.setHours(0, 0, 0, 0);
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const ecart = Math.round((jour.getTime() - aujourdhui.getTime()) / 86_400_000);
    if (ecart === 0) return this.i18n.t('MEDECIN.AGENDA.AUJOURDHUI');
    if (ecart === 1) return this.i18n.t('MEDECIN.AGENDA.DEMAIN');
    return d.toLocaleDateString(this.i18n.lang() === 'en' ? 'en-GB' : 'fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  /** Le patient est là et attend : c'est ce que le médecin doit voir en premier. */
  attend(r: RendezVousMedecinView): boolean {
    return r.statut === 'PRESENT';
  }

  /** Un créneau dépassé sans que le patient soit pointé. */
  enRetard(r: RendezVousMedecinView): boolean {
    return r.statut === 'PLANIFIE' && new Date(r.prevuLe).getTime() < Date.now();
  }

  changer(r: RendezVousMedecinView, statut: 'EN_CONSULTATION' | 'TERMINE' | 'ABSENT') {
    if (this.enCours()) return;
    this.enCours.set(r.id);
    this.service.changerStatutRendezVous(r.id, statut).subscribe({
      next: (res) => {
        this.enCours.set(null);
        const maj = res.data;
        if (maj) this.rdvs.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
      },
      error: (err) => {
        this.enCours.set(null);
        const e = err as { status?: number; error?: { error?: string } };
        this.toastr.error(
          e?.status === 0
            ? this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE')
            : e?.error?.error ?? this.i18n.t('MEDECIN.AGENDA.ERR_STATUT'),
          this.i18n.t('COMMON.ERROR_TITLE')
        );
        this.charger();
      },
    });
  }

  libelleStatut(s: StatutRendezVous): string {
    return this.i18n.t('MEDECIN.STATUT_RDV.' + s);
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
