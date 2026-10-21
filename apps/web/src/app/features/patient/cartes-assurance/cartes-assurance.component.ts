// features/patient/cartes-assurance — les cartes d'assurance du patient.
//
// Lot assurance, point 3. Une carte par police individuelle et une par
// adhesion au contrat collectif d'une entreprise. Le patient la montre a
// l'ecran, la telecharge ou l'imprime.
//
// **Le QR ne porte que le jeton opaque** : ni nom, ni numero, ni donnee
// medicale. Ce qui est imprime autour sert a lire la carte ; ce qui decide
// du tiers payant, c'est la verification serveur au comptoir.
import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import QRCode from 'qrcode';
import type { CarteAssuranceView } from '@baobaoheath/shared-types';

import { PatientService } from '../../../core/services/patient.service';
import { CategorieProduitPipe } from '../../../shared/pipes/categorie-produit.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

/**
 * Les couleurs de la carte imprimee : celles du theme **clair**, quel que
 * soit le theme de l'ecran, car le papier est blanc. Ce sont les valeurs de
 * `--bb-surface-card`, `--bb-text-primary`, `--bb-text-secondary` et
 * `--bb-success` du theme clair (styles.scss). Seul `--bb-primary`, identique
 * dans les deux themes, est relu a l'execution.
 */
const IMPRESSION = {
  fond: '#FFFFFF',
  texte: '#0D2B1A',
  texteSecondaire: '#3A5848',
  garanties: '#1A5C35',
  surPrimaire: '#FFFFFF',
};
const POLICE_TITRE = "'Sora', sans-serif";
const POLICE_TEXTE = "'DM Sans', 'Segoe UI', sans-serif";

/** Une carte, avec l'image de son QR une fois generee. */
type CarteAffichee = CarteAssuranceView & { qr: string };

@Component({
  selector: 'app-patient-cartes-assurance',
  standalone: true,
  imports: [DatePipe, MatButtonModule, CategorieProduitPipe, TranslatePipe],
  templateUrl: './cartes-assurance.component.html',
  styleUrl: './cartes-assurance.component.scss',
})
export class CartesAssuranceComponent implements OnInit {
  private patients = inject(PatientService);
  private i18n = inject(I18nService);

  cartes = signal<CarteAffichee[]>([]);
  chargement = signal(true);
  erreur = signal('');

  ngOnInit() {
    this.patients.mesCartesAssurance().subscribe({
      next: async (r) => {
        const cartes = r.data ?? [];
        // Marge et correction elevees : le code est souvent scanne sur un
        // ecran raye ou une impression pliee.
        const qrs = await Promise.all(cartes.map((c) =>
          QRCode.toDataURL(c.jetonCarte, { width: 320, margin: 2, errorCorrectionLevel: 'Q' }).catch(() => '')
        ));
        this.cartes.set(cartes.map((c, i) => ({ ...c, qr: qrs[i] ?? '' })));
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(err?.error?.error ?? this.i18n.t('PATIENT.CARTES.ERR_LOAD'));
      },
    });
  }

  estUtilisable(c: CarteAssuranceView): boolean {
    return c.statut === 'ACTIF';
  }

  async telecharger(c: CarteAffichee) {
    const image = await this.dessiner(c);
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = `carte-assurance-${c.assureur.code}-${c.numeroAdherent}.png`.replace(/[^\w.-]+/g, '-');
    a.click();
  }

  /**
   * Imprime la carte seule, dans une fenetre a part : imprimer la page
   * emporterait le menu et les autres cartes.
   */
  async imprimer(c: CarteAffichee) {
    const image = await this.dessiner(c);
    const fenetre = image ? window.open('', '_blank', 'width=900,height=650') : null;
    if (!fenetre) {
      this.erreur.set(this.i18n.t('PATIENT.CARTES.ERR_IMPRESSION'));
      return;
    }
    const doc = fenetre.document;
    doc.title = this.i18n.t('PATIENT.CARTES.TITRE');
    const style = doc.createElement('style');
    style.textContent = '@page { margin: 12mm; } body { margin: 0; display: flex; justify-content: center; }'
      + ' img { width: 85.6mm; height: auto; }';
    doc.head.appendChild(style);
    const img = doc.createElement('img');
    img.alt = doc.title;
    img.onload = () => { fenetre.focus(); fenetre.print(); };
    img.src = image!;
    doc.body.appendChild(img);
  }

  /** La carte au format bancaire (85,6 x 54 mm), dessinee en PNG haute definition. */
  private async dessiner(c: CarteAffichee): Promise<string | null> {
    if (!c.qr) return null;
    const L = 1712;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = L;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Le canvas n'attend pas les polices : sans ce chargement explicite, la
    // carte sortirait dans la police systeme.
    await Promise.all([
      document.fonts.load(`800 64px ${POLICE_TITRE}`),
      document.fonts.load(`400 34px ${POLICE_TEXTE}`),
      document.fonts.load(`500 40px ${POLICE_TEXTE}`),
      document.fonts.load(`700 46px ${POLICE_TEXTE}`),
    ]).catch(() => undefined);
    const primaire = getComputedStyle(document.documentElement).getPropertyValue('--bb-primary').trim() || '#2D7D46';

    ctx.fillStyle = IMPRESSION.fond;
    ctx.fillRect(0, 0, L, H);
    ctx.fillStyle = primaire;
    ctx.fillRect(0, 0, L, 170);
    ctx.fillStyle = IMPRESSION.surPrimaire;
    ctx.font = `800 64px ${POLICE_TITRE}`;
    ctx.fillText(c.assureur.nom, 60, 105, L - 400);
    ctx.font = `500 40px ${POLICE_TEXTE}`;
    ctx.textAlign = 'right';
    ctx.fillText(c.assureur.code, L - 60, 105);
    ctx.textAlign = 'left';

    const lignes: [string, string][] = [
      [this.i18n.t('PATIENT.CARTES.BENEFICIAIRE'), `${c.beneficiaire.prenom} ${c.beneficiaire.nom}`],
      [this.i18n.t('PATIENT.CARTES.ADHERENT'), c.numeroAdherent],
      [this.i18n.t('PATIENT.CARTES.POLICE'), c.numeroPolice],
      [this.i18n.t('PATIENT.CARTES.VALIDITE'), `${this.date(c.dateEffet)} → ${c.dateFin ? this.date(c.dateFin) : '—'}`],
    ];
    if (c.souscripteur) lignes.splice(1, 0, [this.i18n.t('PATIENT.CARTES.ENTREPRISE'), c.souscripteur]);

    let y = 260;
    for (const [libelle, valeur] of lignes) {
      ctx.fillStyle = IMPRESSION.texteSecondaire;
      ctx.font = `400 34px ${POLICE_TEXTE}`;
      ctx.fillText(libelle, 60, y);
      ctx.fillStyle = IMPRESSION.texte;
      ctx.font = `700 46px ${POLICE_TEXTE}`;
      ctx.fillText(valeur, 60, y + 52, 1000);
      y += 128;
    }

    const garanties = [
      `${this.i18n.t('PATIENT.CARTES.TAUX_BASE')} ${c.tauxBasePourcent} %`,
      ...c.garanties.map((g) =>
        `${this.libelleCategorie(g.categorie)} ${g.exclu ? this.i18n.t('PATIENT.CARTES.EXCLU') : `${g.tauxPourcent} %`}`),
    ].join(' · ');
    ctx.fillStyle = IMPRESSION.garanties;
    ctx.font = `700 34px ${POLICE_TEXTE}`;
    ctx.fillText(garanties, 60, H - 70, L - 120);

    const qr = await this.charger(c.qr);
    if (qr) ctx.drawImage(qr, L - 520, 220, 460, 460);
    ctx.fillStyle = IMPRESSION.texteSecondaire;
    ctx.font = `400 28px ${POLICE_TEXTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(this.i18n.t('PATIENT.CARTES.MENTION_QR'), L - 290, 730, 520);
    return canvas.toDataURL('image/png');
  }

  /** Meme libelle que le pipe `categorieProduit`, pour le dessin hors gabarit. */
  private libelleCategorie(categorie: string): string {
    const cle = `CATALOGUE.CATEGORIE.${categorie}`;
    const libelle = this.i18n.t(cle);
    return libelle === cle ? categorie : libelle;
  }

  private charger(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  private date(valeur: string | Date): string {
    return new Date(valeur).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
}
