import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import type { CourseLivreurView, ProposerOffreCourseDto } from '@baobaoheath/shared-types';
import { CourseService } from '../../../core/services/course.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface OffreForm {
  prixGnf: string;
  delaiMinutes: string;
}

@Component({
  selector: 'app-livreur-courses',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class LivreurCoursesComponent implements OnInit {
  private readonly coursesService = inject(CourseService);
  private readonly toastr = inject(ToastrService);

  readonly courses = signal<CourseLivreurView[]>([]);
  readonly formulaires = signal<Record<string, OffreForm>>({});
  readonly envoyees = signal<Record<string, boolean>>({});
  readonly chargement = signal(true);
  readonly envoi = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.coursesService.coursesOuvertes().subscribe({
      next: (response) => {
        this.courses.set(response.data ?? []);
        this.chargement.set(false);
      },
      error: (error: unknown) => {
        this.chargement.set(false);
        this.toastr.error(this.messageErreur(error));
      },
    });
  }

  formulaire(id: string): OffreForm {
    return this.formulaires()[id] ?? { prixGnf: '', delaiMinutes: '' };
  }

  modifier(id: string, champ: keyof OffreForm, valeur: string): void {
    this.formulaires.update((forms) => ({
      ...forms,
      [id]: { ...this.formulaire(id), [champ]: valeur },
    }));
  }

  peutEnvoyer(course: CourseLivreurView): boolean {
    const form = this.formulaire(course.id);
    return !this.envoi()
      && Number.isSafeInteger(Number(form.prixGnf)) && Number(form.prixGnf) > 0
      && Number.isSafeInteger(Number(form.delaiMinutes)) && Number(form.delaiMinutes) > 0;
  }

  proposer(course: CourseLivreurView): void {
    if (!this.peutEnvoyer(course)) return;
    const form = this.formulaire(course.id);
    const dto: ProposerOffreCourseDto = {
      prixGnf: Number(form.prixGnf),
      delaiMinutes: Number(form.delaiMinutes),
    };
    this.envoi.set(course.id);
    this.coursesService.proposer(course.id, dto).subscribe({
      next: () => {
        this.envoi.set(null);
        this.envoyees.update((items) => ({ ...items, [course.id]: true }));
      },
      error: (error: unknown) => {
        this.envoi.set(null);
        this.toastr.error(this.messageErreur(error));
      },
    });
  }

  private messageErreur(error: unknown): string {
    const response = error as { error?: { error?: string } };
    return response?.error?.error ?? 'Une erreur est survenue.';
  }
}
