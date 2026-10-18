import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PublicShellComponent } from '../../../shared/components/public-shell/public-shell.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PublicShellComponent],
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent {}
