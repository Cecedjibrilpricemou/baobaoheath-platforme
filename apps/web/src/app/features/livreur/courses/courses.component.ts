import { Component } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-livreur-courses',
  standalone: true,
  imports: [TranslatePipe],
  template: '<h1>{{ "LIVREUR.COURSES.TITRE" | translate }}</h1>',
})
export class LivreurCoursesComponent {}
