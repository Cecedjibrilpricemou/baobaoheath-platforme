// Les parcours qui font la plateforme, enchaines comme sur le terrain :
//
//   1. l'ASC recoit Awa Diallo, prescrit un medicament, cloture ; puis la
//      revoit et la refere au centre de sante ;
//   2. le medecin du centre accepte le transfert — et Awa en est prevenue ;
//   3. la pharmacie de la prefecture voit l'ordonnance en attente et la delivre ;
//   4. l'admin du centre retrouve ses agents, compteur et liste d'accord.
//
// Chaque test depend du precedent (mode serial) : c'est voulu, on verifie la
// chaine, pas des ecrans isoles.
import { expect, test, type Page } from '@playwright/test';
import { E2E, choisirOption, cliquer, fermerOverlay, login } from './helpers';

test.describe.configure({ mode: 'serial' });

/** Triage complet jusqu'a la creation, puis ouverture de la fiche. Renvoie l'id. */
async function creerConsultationParTriage(page: Page): Promise<string> {
  await page.goto('/asc/triage');

  // Etape 1 : retrouver la patiente
  await page.locator('.bb-search__input').fill(E2E.patient.prenom);
  await page.getByRole('button', { name: /rechercher/i }).click();
  await page.locator('.patient-card.selectable', { hasText: `${E2E.patient.prenom} ${E2E.patient.nom}` }).first().click();
  await page.getByRole('button', { name: /suivant/i }).click();

  // Etape 2 : symptomes et constantes
  await page.locator('mat-select#triage-symptomes').click();
  const options = page.getByRole('option');
  await options.nth(0).click();
  await options.nth(1).click();
  await fermerOverlay(page);
  await page.locator('#triage-tension').fill('12/8');
  await page.getByRole('button', { name: /lancer l'analyse|analyse/i }).click();

  // Etape 3 : analyse puis creation
  await expect(page.locator('.ia-result')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /créer la consultation/i }).click();
  await expect(page).toHaveURL(/\/asc\/consultations$/);

  // La liste est triee par date decroissante : la premiere carte est la notre.
  await page.locator('.consult-card', { hasText: E2E.patient.nom }).first().click();
  await expect(page).toHaveURL(/\/asc\/consultations\/[\w-]+$/);
  return page.url().split('/').pop()!;
}

test('1. ASC — consultation, ordonnance, cloture, puis referencement', async ({ page }) => {
  await login(page, E2E.asc.email);
  await expect(page).toHaveURL(/\/asc\/consultations/);

  // ── Consultation A : ordonnance + cloture (ce que la pharmacie delivrera) ──
  await creerConsultationParTriage(page);

  await page.getByRole('button', { name: /ordonnances/i }).click();
  await choisirOption(page, 'ordo-medicament', E2E.medicamentDci);
  await page.locator('#ordo-posologie').fill('1 comprimé');
  await page.locator('#ordo-frequence').fill('3 fois par jour');
  await page.locator('#ordo-duree').fill('5');
  await cliquer(page, page.locator('.bb-detail__submit-btn:visible'));
  await expect(page.getByText(/ordonnance ajoutée/i)).toBeVisible();

  await cliquer(page, page.getByRole('button', { name: /clôturer la consultation/i }));
  await page.locator('.bb-logout-modal__btn:not(.bb-logout-modal__btn--cancel)').click();
  await expect(page.getByText(/clôturée avec succès/i)).toBeVisible();

  // ── Consultation B : referencement vers le centre du medecin ──
  await creerConsultationParTriage(page);

  await page.getByRole('button', { name: /référencement/i }).click();
  await choisirOption(page, 'ref-structure', E2E.centre);
  await choisirOption(page, 'ref-urgence', 'Urgent');
  await page.locator('#ref-resume').fill('Fièvre persistante depuis 3 jours, à évaluer au centre.');
  await cliquer(page, page.locator('.bb-detail__submit-btn:visible'));
  await expect(page.getByText(/référencement (créé|effectué)/i).first()).toBeVisible();
});

test('2. Medecin — accepte le transfert, la patiente est notifiee', async ({ page, browser }) => {
  await login(page, E2E.medecin.email);
  await expect(page).toHaveURL(/\/medecin\/dashboard/);

  await page.goto('/medecin/referencements');
  const ligne = page.locator('.bb-med-cons__item', { hasText: `${E2E.patient.prenom} ${E2E.patient.nom}` });
  await expect(ligne.first()).toBeVisible();
  // Sur une base rejouee, d'autres referencements d'Awa peuvent attendre :
  // on verifie qu'il en part exactement un.
  const enAttenteAvant = await ligne.count();
  await ligne.first().click();

  await expect(page.getByText(/fièvre persistante/i).first()).toBeVisible();
  await page.getByRole('button', { name: /accepter le transfert/i }).click();
  await expect(page.getByText(/transfert accepté/i).first()).toBeVisible();

  // Un de moins a traiter ; la patiente apparait dans "Acceptés".
  await expect(ligne).toHaveCount(enAttenteAvant - 1);
  await page.getByRole('tab', { name: /acceptés/i }).click();
  await expect(page.locator('.bb-med-cons__item', { hasText: E2E.patient.nom }).first()).toBeVisible();

  // Cote patiente : la cloche porte la notification (pas d'OTP pour les patients).
  const contextePatiente = await browser.newContext({ locale: 'fr-FR' });
  const pagePatiente = await contextePatiente.newPage();
  await login(pagePatiente, E2E.patient.telephone);
  await expect(pagePatiente).toHaveURL(/\/patient\/dashboard/);
  const badge = pagePatiente.locator('.bb-bell .mat-badge-content');
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveText('0');
  await pagePatiente.locator('.bb-bell').click();
  // .first() : sur une base rejouee, chaque run ajoute une notification identique.
  await expect(pagePatiente.getByText(new RegExp(`transfert vers ${E2E.centre} accepté`, 'i')).first()).toBeVisible();
  await contextePatiente.close();
});

test('3. Pharmacien — voit l ordonnance en attente et la delivre', async ({ page }) => {
  await login(page, E2E.pharmacien.email);
  await expect(page).toHaveURL(/\/pharmacien\/ordonnances/);

  // Le scanner camera s'ouvre et se referme proprement. Sans camera (CI,
  // headless) il affiche un message et propose la saisie manuelle : c'est
  // ce repli qu'on verifie, pas la lecture elle-meme.
  await page.getByRole('button', { name: /scanner avec la caméra/i }).click();
  const scanner = page.getByRole('dialog', { name: /scanner un qr code/i });
  await expect(scanner).toBeVisible();
  await scanner.getByRole('button', { name: /saisir le code/i }).click();
  await expect(scanner).toBeHidden();

  // La liste de la prefecture propose la patiente ; un clic ouvre la delivrance.
  const attente = page.locator('.bb-ordo__pending-item', { hasText: `${E2E.patient.prenom} ${E2E.patient.nom}` });
  await expect(attente.first()).toBeVisible();
  await attente.first().click();

  await expect(page.locator('.bb-ordo__patient-name')).toContainText(E2E.patient.nom);
  const lignes = page.locator('.bb-ordo__item', { hasText: E2E.medicament });
  await expect(lignes.first()).toBeVisible();
  // Sur une base rejouee, les runs precedents ont laisse d'autres lignes en
  // attente : on verifie qu'il en part exactement une.
  const avant = await lignes.count();
  await lignes.first().locator('.bb-ordo__btn-select').click();

  await expect(page.locator('#ordo-qty')).toBeVisible();
  await page.locator('.bb-ordo__deliver-btn').click();
  await expect(page.getByText(/médicaments délivrés/i)).toBeVisible();

  await expect(lignes).toHaveCount(avant - 1);
});

test('4. Admin structure — voit ses agents, le compteur suit la liste', async ({ page }) => {
  await login(page, E2E.adminStructure.email);
  await expect(page).toHaveURL(/\/admin-structure\/dashboard/);

  const compteur = page.locator('.bb-stat__value').first();
  await expect(compteur).not.toHaveText('0');
  const attendu = Number((await compteur.textContent())?.trim());

  await page.goto('/admin-structure/agents');
  const agents = page.locator('.bb-agents__item');
  await expect(agents.first()).toBeVisible();
  // L'ASC et le medecin du centre, pas l'admin lui-meme.
  await expect(agents).toHaveCount(attendu);
  await expect(agents.filter({ hasText: 'Mamadou Bah' })).toHaveCount(1);
  await expect(agents.filter({ hasText: 'Fatoumata Camara' })).toHaveCount(1);
});
