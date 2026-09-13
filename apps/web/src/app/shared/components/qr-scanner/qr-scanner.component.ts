// shared/components/qr-scanner/qr-scanner.component.ts
// Lecture d'un QR code avec la camera de l'appareil. Decodage par jsQR sur
// les images de la video (aucune dependance native, marche partout ou
// getUserMedia existe : Chrome/Firefox/Safari, Android, iOS).
//
// Utilise en pharmacie (ouvrir la fiche d'un patient au comptoir) et en
// triage ASC (retrouver un patient sans taper son nom). Le composant ne
// sait rien du contenu du code : il emet le texte lu, l'appelant decide.
import { Component, DestroyRef, ElementRef, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import jsQR from 'jsqr';
import { TranslatePipe } from '../../pipes/translate.pipe';

type EtatScanner = 'demarrage' | 'actif' | 'erreur';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss',
})
export class QrScannerComponent implements OnInit {
  /** Texte du QR code lu. Emis une seule fois : la camera s'arrete aussitot. */
  detecte = output<string>();
  /** Fermeture par l'utilisateur (bouton ou fond), sans lecture. */
  ferme = output<void>();

  etat = signal<EtatScanner>('demarrage');
  /** Cle i18n du message d'erreur (QR_SCANNER.ERR_*). */
  erreurKey = signal<string>('');

  private video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private destroyRef = inject(DestroyRef);
  private flux: MediaStream | null = null;
  private boucle = 0;
  private readonly canvas = document.createElement('canvas');

  ngOnInit() {
    this.destroyRef.onDestroy(() => this.arreter());
    void this.demarrer();
  }

  private async demarrer() {
    if (!navigator.mediaDevices?.getUserMedia) {
      // getUserMedia n'existe qu'en contexte securise (HTTPS ou localhost).
      this.echec('ERR_INSECURE');
      return;
    }

    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // Camera arriere sur telephone ; sur un poste fixe, la seule disponible.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (e: unknown) {
      const nom = (e as { name?: string })?.name;
      this.echec(nom === 'NotAllowedError' ? 'ERR_PERMISSION' : nom === 'NotFoundError' ? 'ERR_NO_CAMERA' : 'ERR_GENERIC');
      return;
    }

    const video = this.video().nativeElement;
    video.srcObject = this.flux;
    // playsinline : iOS refuserait sinon de lire la video hors plein ecran.
    video.setAttribute('playsinline', 'true');
    try {
      await video.play();
    } catch {
      this.echec('ERR_GENERIC');
      return;
    }

    this.etat.set('actif');
    this.boucle = requestAnimationFrame(() => this.analyser());
  }

  private analyser() {
    const video = this.video().nativeElement;
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth, h = video.videoHeight;
      if (w > 0 && h > 0) {
        this.canvas.width = w;
        this.canvas.height = h;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(video, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const code = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          this.arreter();
          this.detecte.emit(code.data.trim());
          return;
        }
      }
    }
    this.boucle = requestAnimationFrame(() => this.analyser());
  }

  private echec(cle: string) {
    this.erreurKey.set(`QR_SCANNER.${cle}`);
    this.etat.set('erreur');
  }

  fermer() {
    this.arreter();
    this.ferme.emit();
  }

  private arreter() {
    cancelAnimationFrame(this.boucle);
    this.flux?.getTracks().forEach((t) => t.stop());
    this.flux = null;
  }
}
