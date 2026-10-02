// features/pharmacien/caisse — la vente au comptoir.
//
// Addendum du 2026-09-28, point 1.1. Le client est facultatif : un passant
// n'ouvre pas un dossier pour acheter du savon.
//
// La caisse part du **stock**, pas du catalogue. Le prix au comptoir vaut le
// tarif de reference plus la marge de l'officine, et la marge vit sur la ligne
// de stock : afficher le catalogue seul donnerait un total different de ce qui
// est encaisse. Partir du stock montre en plus ce qui est disponible.
//
// Chaque champ est un signal. L'application est zoneless : `[(ngModel)]` qui
// ecrit dans un champ ordinaire — ou qui mute un objet range dans un signal —
// ne notifie personne, et le total resterait fige. Le formulaire
// d'approvisionnement avait affiche un total faux et un bouton mort pour
// cette raison le 2026-09-30.
import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import type {
  ControleEligibiliteView,
  CreerVenteDto,
  LigneVenteDto,
  ModePaiement,
  PriseEnChargeView,
  VenteComptoirView,
} from '@baobaoheath/shared-types';

import { PharmacienService } from '../../../core/services/pharmacien.service';
import { PharmacieStock } from '../../../core/models/pharmacien.model';
import { CategorieProduitPipe } from '../../../shared/pipes/categorie-produit.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

/** Une ligne du panier en cours de saisie. */
type LignePanier = {
  idMedicament: WritableSignal<string>;
  quantite: WritableSignal<number | null>;
};

@Component({
  selector: 'app-pharmacien-caisse',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, CategorieProduitPipe, TranslatePipe],
  templateUrl: './caisse.component.html',
  styleUrl: './caisse.component.scss',
})
export class CaisseComponent implements OnInit {
  private pharma = inject(PharmacienService);
  private toastr = inject(ToastrService);
  private i18n = inject(I18nService);

  /** Le stock de l'officine : il contient aussi des articles non medicamenteux. */
  stocks = signal<PharmacieStock[]>([]);
  ventes = signal<VenteComptoirView[]>([]);
  isLoading = signal(true);
  enCours = signal(false);

  lignes = signal<LignePanier[]>([this.ligneVide()]);
  modePaiement = signal<ModePaiement>('ESPECES');
  numeroOperateur = signal('');
  remiseGnf = signal<number | null>(null);
  idOrdonnance = signal('');

  readonly montantBrut = computed(() =>
    this.lignes().reduce((t, l) => t + this.prixDe(l.idMedicament()) * (l.quantite() ?? 0), 0)
  );

  readonly remiseAppliquee = computed(() => Math.max(0, Math.trunc(this.remiseGnf() ?? 0)));

  readonly montantNet = computed(() => Math.max(0, this.montantBrut() - this.remiseAppliquee()));

  /**
   * Les produits du panier qui ne sortent pas sans ordonnance. L'API applique
   * la regle de toute facon (EF-05-12) ; l'ecran la dit avant que le vendeur
   * encaisse, pour qu'il ne le decouvre pas au refus.
   */
  readonly exigentOrdonnance = computed(() =>
    this.lignes()
      .map((l) => this.stockDe(l.idMedicament()))
      .filter((s): s is PharmacieStock => !!s && !!s.medicament.estReglemente)
      .map((s) => s.medicament.libelle)
  );

  /** Les lignes qui demandent plus que ce qui reste en rayon. */
  readonly depassements = computed(() =>
    this.lignes()
      .map((l) => ({ stock: this.stockDe(l.idMedicament()), demande: l.quantite() ?? 0 }))
      .filter((x) => x.stock && x.demande > x.stock.quantite)
      .map((x) => `${x.stock!.medicament.libelle} (${x.stock!.quantite} en stock)`)
  );

  readonly peutEncaisser = computed(() =>
    this.lignes().some((l) => l.idMedicament() && (l.quantite() ?? 0) > 0) &&
    this.depassements().length === 0 &&
    (this.modePaiement() === 'ESPECES' || this.numeroOperateur().trim().length > 0) &&
    (this.exigentOrdonnance().length === 0 || this.idOrdonnance().trim().length > 0) &&
    // Le tiers payant demande un patient reconnu eligible : l'API refuserait
    // de toute facon, autant ne pas laisser encaisser a blanc.
    (!this.avecAssurance() || this.peutAppliquerAssurance())
  );

  /** Ce que la caisse encaisse reellement du patient. */
  readonly aEncaisser = computed(() =>
    this.avecAssurance() && this.prise() ? this.prise()!.montantPatientGnf : this.montantNet()
  );

  // ── Tiers payant (EF-09, addendum point 5) ───────────────────────
  //
  // Le patient se reconnait par son QR : c'est le geste deja en place au
  // comptoir. Sans lui, pas de contrat a opposer — et le tiers payant reste
  // ferme.
  qrPatient = signal('');
  patient = signal<{ id: string; prenom: string; nom: string } | null>(null);
  eligibilite = signal<ControleEligibiliteView | null>(null);
  prise = signal<PriseEnChargeView | null>(null);
  avecAssurance = signal(false);
  enCoursAssurance = signal(false);

  readonly peutAppliquerAssurance = computed(
    () => this.eligibilite()?.eligible === true && this.montantBrut() > 0
  );

  readonly modes: ModePaiement[] = ['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO'];

  ngOnInit() {
    this.charger();
    this.pharma.getStocks().subscribe({ next: (r) => this.stocks.set(r.data ?? []) });
  }

  private ligneVide(): LignePanier {
    return { idMedicament: signal(''), quantite: signal<number | null>(1) };
  }

  private charger() {
    this.isLoading.set(true);
    this.pharma.getVentes(20).subscribe({
      next: (r) => {
        this.ventes.set(r.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('PHARMACIEN.CAISSE.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      },
    });
  }

  stockDe(idMedicament: string): PharmacieStock | undefined {
    return this.stocks().find((s) => s.medicament.id === idMedicament);
  }

  /** Le prix au comptoir, tel que l'API le calcule : reference plus marge. */
  prixDe(idMedicament: string): number {
    const s = this.stockDe(idMedicament);
    return s ? s.medicament.prixUnitaireGnf + (s.margeGnf ?? 0) : 0;
  }

  libelleProduit(s: PharmacieStock): string {
    const m = s.medicament;
    const bas = m.libelle.toLowerCase();
    const sup = [m.dosage, m.forme].filter((x): x is string => !!x && !bas.includes(x.toLowerCase()));
    return [m.libelle, ...sup].join(' · ');
  }

  /** Reconnait le patient par son QR, comme au guichet de delivrance. */
  scannerPatient() {
    const qr = this.qrPatient().trim();
    if (!qr) return;
    this.enCoursAssurance.set(true);
    this.pharma.scanQrCode(qr).subscribe({
      next: (r) => {
        this.enCoursAssurance.set(false);
        const p = (r.data as unknown as { patient?: { id: string; prenom: string; nom: string } })?.patient;
        if (!p?.id) {
          this.toastr.error(this.i18n.t('PHARMACIEN.CAISSE.QR_INCONNU'), this.i18n.t('COMMON.ERROR_TITLE'));
          return;
        }
        this.patient.set({ id: p.id, prenom: p.prenom, nom: p.nom });
        this.eligibilite.set(null);
        this.prise.set(null);
        this.avecAssurance.set(false);
      },
      error: (err) => {
        this.enCoursAssurance.set(false);
        this.signaler(err, 'PHARMACIEN.CAISSE.QR_INCONNU');
      },
    });
  }

  oublierPatient() {
    this.patient.set(null);
    this.qrPatient.set('');
    this.eligibilite.set(null);
    this.prise.set(null);
    this.avecAssurance.set(false);
  }

  /**
   * Controle d'eligibilite. La reponse est enregistree cote API : un refus
   * n'est pas une erreur, il porte son motif et s'affiche tel quel.
   */
  verifierEligibilite() {
    const p = this.patient();
    if (!p) return;
    this.enCoursAssurance.set(true);
    this.pharma.verifierEligibilite(p.id).subscribe({
      next: (r) => {
        this.enCoursAssurance.set(false);
        this.eligibilite.set(r.data ?? null);
        if (r.data?.eligible) this.simuler();
        else this.avecAssurance.set(false);
      },
      error: (err) => {
        this.enCoursAssurance.set(false);
        this.signaler(err, 'PHARMACIEN.CAISSE.ERR_ELIGIBILITE');
      },
    });
  }

  /** Chiffre la prise en charge avant le paiement, sans rien enregistrer. */
  simuler() {
    const p = this.patient();
    if (!p || this.montantBrut() <= 0) return;

    const lignes = this.lignes()
      .map((l) => ({ stock: this.stockDe(l.idMedicament()), quantite: l.quantite() ?? 0 }))
      .filter((x) => x.stock && x.quantite > 0)
      .map((x) => ({
        idMedicament: x.stock!.medicament.id,
        libelle: x.stock!.medicament.libelle,
        categorie: x.stock!.medicament.categorie,
        montantGnf: this.prixDe(x.stock!.medicament.id) * x.quantite,
      }));
    if (lignes.length === 0) return;

    this.enCoursAssurance.set(true);
    this.pharma.simulerPriseEnCharge(p.id, lignes, this.montantNet()).subscribe({
      next: (r) => {
        this.enCoursAssurance.set(false);
        this.prise.set(r.data ?? null);
        if (r.data) this.avecAssurance.set(true);
      },
      error: (err) => {
        this.enCoursAssurance.set(false);
        this.prise.set(null);
        this.avecAssurance.set(false);
        this.signaler(err, 'PHARMACIEN.CAISSE.ERR_SIMULATION');
      },
    });
  }

  ajouterLigne() {
    this.lignes.update((l) => [...l, this.ligneVide()]);
  }

  retirerLigne(index: number) {
    this.lignes.update((l) => (l.length === 1 ? l : l.filter((_, i) => i !== index)));
  }

  encaisser() {
    if (this.enCours() || !this.peutEncaisser()) return;
    this.enCours.set(true);

    const lignes: LigneVenteDto[] = this.lignes()
      .filter((l) => l.idMedicament() && (l.quantite() ?? 0) > 0)
      .map((l) => ({ idMedicament: l.idMedicament(), quantite: Number(l.quantite()) }));

    const dto: CreerVenteDto = {
      lignes,
      modePaiement: this.modePaiement(),
      ...(this.modePaiement() !== 'ESPECES' ? { numeroOperateur: this.numeroOperateur().trim() } : {}),
      ...(this.remiseAppliquee() > 0 ? { remiseGnf: this.remiseAppliquee() } : {}),
      ...(this.idOrdonnance().trim() ? { idOrdonnance: this.idOrdonnance().trim() } : {}),
      ...(this.patient() ? { idPatient: this.patient()!.id } : {}),
      ...(this.avecAssurance() && this.peutAppliquerAssurance() ? { avecAssurance: true } : {}),
    };

    this.pharma.enregistrerVente(dto).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.toastr.success(
          this.i18n.t('PHARMACIEN.CAISSE.OK', { numero: r.data?.numero ?? '' }),
          this.i18n.t('COMMON.SUCCESS')
        );
        this.reinitialiser();
        this.charger();
        // Le stock a baisse : le relire evite d'autoriser une seconde vente
        // sur une quantite qui n'existe plus.
        this.pharma.getStocks().subscribe({ next: (s) => this.stocks.set(s.data ?? []) });
      },
      error: (err) => this.signaler(err, 'PHARMACIEN.CAISSE.ERR_ENCAISSER'),
    });
  }

  annuler(vente: VenteComptoirView) {
    const motif = window.prompt(this.i18n.t('PHARMACIEN.CAISSE.MOTIF_PROMPT'))?.trim() ?? '';
    if (motif.length < 5) {
      if (motif.length > 0) {
        this.toastr.error(this.i18n.t('PHARMACIEN.CAISSE.MOTIF_COURT'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
      return;
    }

    this.pharma.annulerVente(vente.id, { motif }).subscribe({
      next: () => {
        this.toastr.success(this.i18n.t('PHARMACIEN.CAISSE.ANNULEE'), this.i18n.t('COMMON.SUCCESS'));
        this.charger();
        this.pharma.getStocks().subscribe({ next: (s) => this.stocks.set(s.data ?? []) });
      },
      error: (err) => this.signaler(err, 'PHARMACIEN.CAISSE.ERR_ANNULER'),
    });
  }

  /**
   * Un serveur injoignable n'est pas une erreur de saisie : le dire evite de
   * chercher la faute dans le panier.
   */
  private signaler(err: unknown, cleDefaut: string) {
    this.enCours.set(false);
    const e = err as { status?: number; error?: { error?: string } };
    this.toastr.error(
      e?.status === 0
        ? this.i18n.t('AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE')
        : e?.error?.error ?? this.i18n.t(cleDefaut),
      this.i18n.t('COMMON.ERROR_TITLE')
    );
  }

  private reinitialiser() {
    this.oublierPatient();
    this.lignes.set([this.ligneVide()]);
    this.modePaiement.set('ESPECES');
    this.numeroOperateur.set('');
    this.remiseGnf.set(null);
    this.idOrdonnance.set('');
  }
}
