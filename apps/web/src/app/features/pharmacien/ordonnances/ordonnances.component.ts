import { Component, inject, signal, OnInit } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PharmacienService } from '../../../core/services/pharmacien.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import { QrScannerComponent } from '../../../shared/components/qr-scanner/qr-scanner.component';
import type {
  HorodatageApi,
  OrdonnanceDelivranceView,
  OrdonnanceEnAttenteView,
  PatientScanView,
} from '@baobaoheath/shared-types';

@Component({
  selector: 'app-ordonnances',
  standalone: true,
  imports: [
    MatRadioModule,
    MatFormFieldModule, MatInputModule, CommonModule, FormsModule, TranslatePipe, QrScannerComponent],
  templateUrl: './ordonnances.component.html',
  styleUrl: './ordonnances.component.scss'
})
export class OrdonnancesComponent implements OnInit {
  private pharmacienService = inject(PharmacienService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  // Scanner State
  qrCode       = '';
  /** Lecture camera (app-qr-scanner) ; la saisie manuelle reste possible. */
  showScanner  = signal(false);
  isScanning   = signal(false);
  errorMessage = signal('');

  // Patient & Ordonnances State
  patient          = signal<PatientScanView | null>(null);
  ordonnances      = signal<OrdonnanceDelivranceView[]>([]);
  selected         = signal<OrdonnanceDelivranceView | null>(null);
  isDelivering     = signal(false);
  successMessage   = signal('');

  // Formulaire de délivrance
  modePaiement     = 'ESPECES';
  quantiteDelivree = 0;

  get modesPaiement() {
    return [
      { label: this.i18n.t('PHARMACIEN.ORDONNANCES.MODE_CASH'),   value: 'ESPECES'      },
      { label: this.i18n.t('PHARMACIEN.ORDONNANCES.MODE_ORANGE'), value: 'ORANGE_MONEY' },
      { label: this.i18n.t('PHARMACIEN.ORDONNANCES.MODE_MTN'),    value: 'MTN_MOMO'     }
    ];
  }

  // Ordonnances en attente dans la prefecture (GET /pharmacien/ordonnances) :
  // le pharmacien voit qui est attendu et ouvre la delivrance d'un clic,
  // sans attendre que le patient presente son QR code.
  enAttente          = signal<OrdonnanceEnAttenteView[]>([]);
  isLoadingEnAttente = signal(true);

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { scanResult?: { patient?: PatientScanView; ordonnances?: OrdonnanceDelivranceView[] } } | undefined;

    if (state?.scanResult) {
      this.patient.set(state.scanResult.patient ?? null);
      this.ordonnances.set(state.scanResult.ordonnances ?? []);
    }
    // FINI LE BUG : Aucune redirection si aucun scanResult n'est présent !
    // L'interface affichera d'elle-même le composant Scanner (Empty State).

    this.chargerEnAttente();
  }

  chargerEnAttente() {
    this.isLoadingEnAttente.set(true);
    this.pharmacienService.getOrdonnancesEnAttente().subscribe({
      next: res => { this.enAttente.set(res.data ?? []); this.isLoadingEnAttente.set(false); },
      error: () => { this.isLoadingEnAttente.set(false); }
    });
  }

  /** Ouvre la delivrance d'une ordonnance de la liste : meme parcours que le scan. */
  ouvrirDepuisListe(o: OrdonnanceEnAttenteView) {
    this.qrCode = o.patient.qrCode;
    this.scan();
  }

  /** Regroupe la liste par patient : un patient peut avoir plusieurs lignes. */
  get enAttenteParPatient(): { qrCode: string; prenom: string; nom: string; lignes: OrdonnanceEnAttenteView[] }[] {
    const groupes = new Map<string, { qrCode: string; prenom: string; nom: string; lignes: OrdonnanceEnAttenteView[] }>();
    for (const o of this.enAttente()) {
      const g = groupes.get(o.patient.qrCode) ?? { ...o.patient, lignes: [] };
      g.lignes.push(o);
      groupes.set(o.patient.qrCode, g);
    }
    return [...groupes.values()];
  }

  scan() {
    if (!this.qrCode.trim()) {
      this.errorMessage.set(this.i18n.t('PHARMACIEN.ORDONNANCES.ERR_QR_REQUIRED'));
      return;
    }
    this.isScanning.set(true);
    this.errorMessage.set('');
    this.patient.set(null);
    this.ordonnances.set([]);

    this.pharmacienService.scanQrCode(this.qrCode.trim()).subscribe({
      next: (response) => {
        this.isScanning.set(false);
        const raw = response.data as unknown as { patient?: PatientScanView; ordonnances?: OrdonnanceDelivranceView[] } | null;
        this.patient.set(raw?.patient ?? null);
        this.ordonnances.set(raw?.ordonnances ?? []);
      },
      error: (err) => {
        this.isScanning.set(false);
        this.errorMessage.set(err?.error?.error ?? err?.error?.message ?? this.i18n.t('PHARMACIEN.ORDONNANCES.ERR_PATIENT_NOT_FOUND'));
      }
    });
  }

  /** QR lu par la camera : on le traite exactement comme une saisie + Rechercher. */
  onQrDetecte(code: string) {
    this.showScanner.set(false);
    this.qrCode = code;
    this.scan();
  }

  getAge(dateNaissance: string): number | null {
    if (!dateNaissance) return null;
    const n = new Date(dateNaissance);
    if (Number.isNaN(n.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - n.getFullYear();
    if (now < new Date(now.getFullYear(), n.getMonth(), n.getDate())) age--;
    return age;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.scan();
  }

  resetScan() {
    this.patient.set(null);
    this.ordonnances.set([]);
    this.qrCode = '';
    this.errorMessage.set('');
    this.successMessage.set('');
    this.selected.set(null);
  }

  selectionner(o: OrdonnanceDelivranceView) {
    this.selected.set(o);
    this.quantiteDelivree = o.quantite;
    this.modePaiement = 'ESPECES';
    this.errorMessage.set('');
  }

  annuler() { this.selected.set(null); this.errorMessage.set(''); }

  delivrer() {
    const o = this.selected();
    if (!o) return;

    this.isDelivering.set(true);
    this.errorMessage.set('');

    this.pharmacienService.delivrerOrdonnance(o.id, {
      modePaiement: this.modePaiement,
      quantiteDelivree: this.quantiteDelivree
    } as unknown as import('../../../core/models/pharmacien.model').DelivrancePayload).subscribe({
      next: (response) => {
        this.isDelivering.set(false);
        this.selected.set(null);
        this.ordonnances.update(list => list.filter(ord => ord.id !== o.id));
        this.enAttente.update(list => list.filter(ord => ord.id !== o.id));
        const responseData = response?.data as { montantGnf?: number };
        this.successMessage.set(this.i18n.t('PHARMACIEN.ORDONNANCES.SUCCESS_DELIVERED', { amount: this.formatMontant(responseData?.montantGnf ?? 0) }));
        setTimeout(() => this.successMessage.set(''), 5000);
      },
      error: (err) => {
        this.isDelivering.set(false);
        this.errorMessage.set(err?.error?.error ?? this.i18n.t('PHARMACIEN.ORDONNANCES.ERR_DELIVER'));
      }
    });
  }

  getMontantAvecQuantite(o: OrdonnanceDelivranceView): number {
    return o.medicament.prixUnitaireGnf * this.quantiteDelivree;
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(m);
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
