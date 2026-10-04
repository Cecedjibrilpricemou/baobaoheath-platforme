// features/patient/consentements/consentements.component.ts
// Le patient decide qui peut lire son dossier et a quelles fins (scopes de
// ConsentementPatient), et voit qui y a accede (journal d'audit).
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import type {
  AccesDossierView, ConsentScope, ConsentementView, DemandeRgpdView,
  EtatTexteConsentement, EvenementConsentementView, TexteConsentementView, TypeDemandeRgpd,
} from '@baobaoheath/shared-types';
import { PrivacyService } from '../../../core/services/privacy.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface ScopeItem {
  scope: ConsentScope;
  icon: string;
  actif: boolean;
  /** Date de la derniere decision, null tant que le patient n'a rien choisi. */
  modifieLe: string | Date | null;
  saving: boolean;

  // ── Ce que le versionnage ajoute (EF-02-01) ────────────────────────
  //
  // **La difference entre un accord et une case cochee a sa place.** Un
  // consentement pose par le systeme a la creation du dossier n'a jamais ete
  // recueilli : personne n'a rien montre a personne. L'ecran doit le dire, pas
  // l'afficher comme un accord ordinaire.
  /** `false` : la question ne lui a jamais ete posee. */
  repondu: boolean;
  etat: EtatTexteConsentement;
  /** Le texte qu'il a accepte, tel qu'il etait — pas celui d'aujourd'hui. */
  texteAccepte: TexteConsentementView | null;
  texteEnVigueur: TexteConsentementView | null;
  /** `DEFAUT_SYSTEME` quand l'accord a ete pose sans geste du patient. */
  source: string | null;
  texteOuvert: boolean;
}

// Ordre d'affichage : du plus structurant (acces au dossier) au plus accessoire.
const SCOPES: { scope: ConsentScope; icon: string }[] = [
  { scope: 'DOSSIER_MEDICAL',      icon: 'pi-folder-open' },
  { scope: 'RAPPELS_SMS',          icon: 'pi-mobile' },
  { scope: 'FHIR_EXPORT',          icon: 'pi-share-alt' },
  { scope: 'RECHERCHE_ANONYMISEE', icon: 'pi-chart-bar' },
];

@Component({
  selector: 'app-consentements',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatCardModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule,
  ],
  templateUrl: './consentements.component.html',
  styleUrl: './consentements.component.scss',
})
export class ConsentementsComponent implements OnInit {
  private privacyService = inject(PrivacyService);
  private i18n = inject(I18nService);
  private toastr = inject(ToastrService);

  // Tant que l'API n'a pas repondu, aucune portee n'est « accordee » et aucune
  // n'est « repondue » : afficher le contraire ferait croire au patient qu'il a
  // consenti a quelque chose.
  scopes = signal<ScopeItem[]>(SCOPES.map(s => ({
    ...s, actif: false, modifieLe: null, saving: false,
    repondu: false, etat: 'JAMAIS_RECUEILLI' as const,
    texteAccepte: null, texteEnVigueur: null, source: null, texteOuvert: false,
  })));
  acces = signal<AccesDossierView[]>([]);
  totalAcces = signal(0);
  isLoading = signal(true);
  isLoadingAcces = signal(true);
  /**
   * Ne montrer que les acces d'autrui.
   *
   * Les consultations du patient lui-meme representaient 273 lignes sur 850
   * dans la base de demonstration : sans ce filtre, elles noient les deux
   * lignes qui comptent. Le journal reste complet par defaut — on ne cache
   * rien — mais il doit pouvoir se reduire a la question qu'on se pose.
   */
  parTiersSeulement = signal(false);

  // ── Mes droits (EF-12-09) ──────────────────────────────────────────
  //
  // Deposer une demande est un droit. Rien ne s'execute automatiquement :
  // l'administration repond par ecrit, dans un delai annonce. L'ecran le dit,
  // pour qu'un patient ne clique pas « effacement » en croyant que son
  // dossier disparaitra dans la minute.
  demandes = signal<DemandeRgpdView[]>([]);
  demandesChargees = signal(false);
  typeChoisi = signal<TypeDemandeRgpd | ''>('');
  precision = signal('');
  envoiEnCours = signal(false);
  erreurDemande = signal('');
  succesDemande = signal('');

  typesDemande: TypeDemandeRgpd[] = [
    'ACCES', 'RECTIFICATION', 'PORTABILITE', 'OPPOSITION', 'LIMITATION', 'EFFACEMENT',
  ];

  /** La precision est obligatoire pour une rectification : sinon on ne sait pas quoi corriger. */
  precisionRequise = computed(() => this.typeChoisi() === 'RECTIFICATION');

  peutEnvoyer = computed(() => {
    if (!this.typeChoisi() || this.envoiEnCours()) return false;
    return !this.precisionRequise() || this.precision().trim().length >= 10;
  });

  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.registerFontClassAlias('pi', 'pi');
  }

  ngOnInit() {
    this.privacyService.getMyConsents().subscribe({
      next: res => {
        this.appliquer(res.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error(this.i18n.t('PATIENT.CONSENTS.ERR_LOAD'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });

    this.chargerAcces();
    this.chargerDemandes();
  }

  private chargerDemandes() {
    this.privacyService.mesDemandesRgpd().subscribe({
      next: (res) => {
        this.demandes.set(res.data ?? []);
        this.demandesChargees.set(true);
      },
      // Un echec ici ne doit pas vider la page : les consentements et le
      // journal d'acces restent consultables.
      error: () => this.demandesChargees.set(true),
    });
  }

  envoyerDemande() {
    const type = this.typeChoisi();
    if (!type || !this.peutEnvoyer()) return;

    this.envoiEnCours.set(true);
    this.erreurDemande.set('');
    this.privacyService.deposerDemandeRgpd({
      type,
      precision: this.precision().trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.envoiEnCours.set(false);
        this.typeChoisi.set('');
        this.precision.set('');
        // On annonce la date limite : c'est l'engagement pris envers le
        // patient, et il doit pouvoir s'y referer.
        const limite = res.data?.dateLimite;
        this.succesDemande.set(this.i18n.t('PATIENT.CONSENTS.RGPD_SENT', {
          date: limite ? new Date(limite).toLocaleDateString(this.i18n.lang() === 'en' ? 'en-GB' : 'fr-FR') : '',
        }));
        setTimeout(() => this.succesDemande.set(''), 10000);
        this.chargerDemandes();
      },
      error: (err) => {
        this.envoiEnCours.set(false);
        const e = err as { error?: { error?: string; message?: string } };
        this.erreurDemande.set(
          e?.error?.error ?? e?.error?.message ?? this.i18n.t('PATIENT.CONSENTS.RGPD_ERR')
        );
      },
    });
  }

  /**
   * La phrase a afficher pour une ligne du journal.
   *
   * L'API rend des cles, pas du texte : l'application est bilingue, et une
   * phrase francaise figee s'afficherait telle quelle a un patient ayant
   * choisi l'anglais. On traduit donc l'objet, puis la phrase qui le recoit.
   * Les phrases qui se suffisent a elles-memes — le scan d'un code — n'ont
   * pas d'objet.
   */
  libelleAcces(a: AccesDossierView): string {
    const objet = a.libelleObjet ? this.i18n.t(a.libelleObjet) : '';
    return this.i18n.t(a.libelle, { objet });
  }

  basculerParTiers(actif: boolean) {
    this.parTiersSeulement.set(actif);
    this.chargerAcces();
  }

  private chargerAcces() {
    this.isLoadingAcces.set(true);
    this.privacyService.getAuditLogs(1, 20, this.parTiersSeulement()).subscribe({
      next: res => {
        this.acces.set(res.data ?? []);
        this.totalAcces.set(res.meta?.total ?? (res.data?.length ?? 0));
        this.isLoadingAcces.set(false);
      },
      error: () => { this.isLoadingAcces.set(false); }
    });
  }

  basculer(item: ScopeItem, actif: boolean) {
    this.patch(item.scope, { saving: true, actif });

    this.privacyService.updateConsent({ scope: item.scope, actif, source: 'WEB' }).subscribe({
      next: res => {
        const c = res.data;
        this.patch(item.scope, {
          saving: false,
          actif: c?.actif ?? actif,
          modifieLe: c ? (c.actif ? c.donneLe : c.retireLe) : new Date(),
        });
        this.toastr.success(
          this.i18n.t(actif ? 'PATIENT.CONSENTS.GRANTED' : 'PATIENT.CONSENTS.REVOKED'),
          this.i18n.t(`PATIENT.CONSENTS.SCOPE.${item.scope}.TITLE`)
        );
      },
      error: err => {
        // Retour a l'etat precedent : le bouton ne doit pas mentir sur ce qui est enregistre.
        this.patch(item.scope, { saving: false, actif: !actif });
        this.toastr.error(err?.error?.error ?? this.i18n.t('PATIENT.CONSENTS.ERR_SAVE'), this.i18n.t('COMMON.ERROR_TITLE'));
      }
    });
  }

  private appliquer(consentements: ConsentementView[]) {
    const parScope = new Map(consentements.map(c => [c.scope, c]));
    this.scopes.update(liste => liste.map(item => {
      const c = parScope.get(item.scope);
      if (!c) return item;
      return {
        ...item,
        actif: c.actif,
        modifieLe: c.actif ? c.donneLe : c.retireLe,
        repondu: c.repondu,
        etat: c.etat,
        texteAccepte: c.texteAccepte,
        texteEnVigueur: c.texteEnVigueur,
        source: c.source,
      };
    }));
  }

  // ── Le texte, et l'histoire ────────────────────────────────────────

  basculerTexte(item: ScopeItem) {
    this.patch(item.scope, { texteOuvert: !item.texteOuvert });
  }

  /**
   * Le texte a montrer : celui qu'il a accepte s'il existe, sinon celui en
   * vigueur. **Jamais l'inverse** — lui presenter le texte d'aujourd'hui comme
   * s'il l'avait accepte serait lui faire dire ce qu'il n'a pas dit.
   */
  texteAMontrer(item: ScopeItem): TexteConsentementView | null {
    return item.texteAccepte ?? item.texteEnVigueur;
  }

  /** Confirmer sur la version du jour, quand l'accord etait presume ou ancien. */
  confirmer(item: ScopeItem) {
    this.basculer(item, true);
  }

  historique = signal<EvenementConsentementView[]>([]);
  historiqueOuvert = signal(false);
  historiqueCharge = signal(false);

  basculerHistorique() {
    const ouvrir = !this.historiqueOuvert();
    this.historiqueOuvert.set(ouvrir);
    if (!ouvrir || this.historiqueCharge()) return;

    this.privacyService.historiqueConsentements().subscribe({
      next: (res) => {
        this.historique.set(res.data ?? []);
        this.historiqueCharge.set(true);
      },
      // Un echec ici ne doit pas vider la page.
      error: () => this.historiqueCharge.set(true),
    });
  }

  private patch(scope: ConsentScope, changes: Partial<ScopeItem>) {
    this.scopes.update(liste => liste.map(item => item.scope === scope ? { ...item, ...changes } : item));
  }
}
