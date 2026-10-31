// Ce que l'écran des consentements dit quand des textes manquent.
//
// Sans aucun texte publié, le même long avertissement se répétait sous les
// quatre usages, et les interrupteurs restaient actifs pour un accord que
// l'API refuse d'enregistrer. Retirer un accord, lui, doit rester possible.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { ConsentementsComponent } from './consentements.component';
import { PrivacyService } from '../../../core/services/privacy.service';

const SCOPES = ['DOSSIER_MEDICAL', 'RAPPELS_SMS', 'FHIR_EXPORT', 'RECHERCHE_ANONYMISEE'];
const texte = (scope: string) => ({
  id: 't-' + scope, scope, langue: 'fr', version: 1, titre: 'Titre', corps: 'Corps du texte',
  publieLe: new Date().toISOString(), dansUneAutreLangue: false,
});

function monter(avecTexte: string[], actifs: string[] = []) {
  const consentements = SCOPES.map((scope) => ({
    scope, actif: actifs.includes(scope), repondu: actifs.includes(scope), etat: 'A_JOUR',
    donneLe: null, retireLe: null, source: null,
    texteAccepte: null, texteEnVigueur: avecTexte.includes(scope) ? texte(scope) : null,
  }));
  const privacy = {
    getMyConsents: () => of({ success: true, data: consentements }),
    getAuditLogs: () => of({ success: true, data: [], meta: { total: 0 } }),
    mesDemandesRgpd: () => of({ success: true, data: [] }),
    historiqueConsentements: () => of({ success: true, data: [] }),
  };
  TestBed.configureTestingModule({
    imports: [ConsentementsComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      { provide: PrivacyService, useValue: privacy },
      { provide: ToastrService, useValue: { success() {}, error() {}, warning() {}, info() {} } },
    ],
  });
  const fixture = TestBed.createComponent(ConsentementsComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const avisParLigne = (el: HTMLElement) => el.querySelectorAll('.consent-row__meta--manque').length;
const avisGlobal = (el: HTMLElement) => el.querySelectorAll('.consent-aucun-texte').length;
const interrupteurs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('.consent-row mat-slide-toggle button'));

describe('consentements sans texte publié', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('aucun texte : un seul avis en tête, aucun sous les lignes', () => {
    const el = monter([]);
    expect(avisGlobal(el)).toBe(1);
    expect(avisParLigne(el)).toBe(0);
  });

  it('un seul usage sans texte : l\'avis reste sur sa ligne', () => {
    const el = monter(['DOSSIER_MEDICAL', 'RAPPELS_SMS', 'FHIR_EXPORT']);
    expect(avisGlobal(el)).toBe(0);
    expect(avisParLigne(el)).toBe(1);
  });

  it('on ne peut pas accorder sans texte, mais on peut toujours retirer', () => {
    const el = monter(['DOSSIER_MEDICAL'], ['RAPPELS_SMS']);
    const [dossier, sms, fhir] = interrupteurs(el);
    expect(dossier.disabled).toBe(false); // texte publié
    expect(sms.disabled).toBe(false);     // accordé : le retrait reste possible
    expect(fhir.disabled).toBe(true);     // ni texte ni accord
  });
});
