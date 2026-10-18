import { expect, test } from '@playwright/test';
import { E2E, login } from './helpers';

const API = 'http://localhost:3137/api/v1';

async function csrfHeaders(page: import('@playwright/test').Page): Promise<Record<string, string>> {
  const csrf = (await page.context().cookies(API)).find((cookie) => cookie.name === 'bb_csrf')?.value;
  if (!csrf) throw new Error('Cookie CSRF missing after authentication');
  return { 'x-csrf-token': csrf };
}

test('Pharmacie — catalogue, stock, vente, agents et cloisonnement entre officines', async ({ page, browser }) => {
  await login(page, E2E.pharmacien.email);
  const suffixe = Date.now().toString().slice(-8);
  const libelleProduit = `Produit acceptance ${suffixe}`;
  const emailAgent = `agent.${suffixe}@baobao.test`;

  const creerProduit = await page.request.post(`${API}/pharmacien/catalogue-local`, {
    headers: await csrfHeaders(page),
    data: {
      libelle: libelleProduit,
      categorie: 'HYGIENE',
      prixUnitaireGnf: 12345,
      seuilAlerte: 3,
      unite: 'flacon',
    },
  });
  expect(creerProduit.ok()).toBeTruthy();
  const produitResponse = await creerProduit.json();
  const produitId = produitResponse.data.id as string;
  expect(produitResponse.data.estPropreOfficine).toBe(true);

  const catalogue = await page.request.get(`${API}/pharmacien/medicaments`);
  expect(catalogue.ok()).toBeTruthy();
  expect((await catalogue.json()).data.some((item: { id: string }) => item.id === produitId)).toBe(true);

  const reappro = await page.request.post(`${API}/pharmacien/stocks/reapprovisionner`, {
    headers: await csrfHeaders(page),
    data: {
      idMedicament: produitId,
      quantiteAjoutee: 8,
      datePeremption: '2028-12-31',
      margeGnf: 9000,
    },
  });
  expect(reappro.ok()).toBeTruthy();

  const venteResponse = await page.request.post(`${API}/pharmacien/ventes`, {
    headers: await csrfHeaders(page),
    data: { lignes: [{ idMedicament: produitId, quantite: 2 }], modePaiement: 'ESPECES' },
  });
  expect(venteResponse.ok()).toBeTruthy();
  const vente = (await venteResponse.json()).data;
  expect(vente.montantNetGnf).toBe(24690);
  expect(vente.statut).toBe('PAYEE');

  const stocks = await page.request.get(`${API}/pharmacien/stocks`);
  const stockLocal = (await stocks.json()).data.find(
    (stock: { medicament: { id: string } }) => stock.medicament.id === produitId,
  );
  expect(stockLocal.quantite).toBe(6);
  expect(stockLocal.seuilAlerte).toBe(3);
  expect(stockLocal.unite).toBe('flacon');
  expect(stockLocal.margeGnf).toBe(0);

  const creerAgent = await page.request.post(`${API}/pharmacien/agents`, {
    headers: await csrfHeaders(page),
    data: {
      telephone: `+2246${suffixe}`,
      email: emailAgent,
      motDePasse: 'Agent-E2e-123',
      prenom: 'Agent',
      nom: 'Test',
    },
  });
  expect(creerAgent.ok()).toBeTruthy();
  const agentId = (await creerAgent.json()).data.agent.id as string;
  const suspendreAgent = await page.request.patch(`${API}/pharmacien/agents/${agentId}/statut`, {
    headers: await csrfHeaders(page),
    data: { estActif: false },
  });
  expect(suspendreAgent.ok()).toBeTruthy();
  expect((await suspendreAgent.json()).data.estActif).toBe(false);

  const connexionAgentSuspendu = await page.request.post(`${API}/auth/login`, {
    data: { identifiant: emailAgent, motDePasse: 'Agent-E2e-123' },
  });
  expect(connexionAgentSuspendu.status()).toBe(401);

  const journal = await page.request.get(`${API}/pharmacien/connexions`);
  const evenements = (await journal.json()).data.items;
  expect(evenements).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'ECHEC_AUTHENTIFICATION',
      utilisateur: expect.objectContaining({ email: emailAgent }),
    }),
  ]));

  const autreContexte = await browser.newContext({ locale: 'fr-FR' });
  try {
    const autrePage = await autreContexte.newPage();
    await login(autrePage, E2E.titulaireAutre.email);
    const autreCatalogue = await autrePage.request.get(`${API}/pharmacien/medicaments`);
    const autresProduits = (await autreCatalogue.json()).data as { id: string }[];
    expect(autresProduits.some((item) => item.id === produitId)).toBe(false);

    const autresStocks = await autrePage.request.get(`${API}/pharmacien/stocks`);
    expect((await autresStocks.json()).data.some(
      (stock: { medicament: { id: string } }) => stock.medicament.id === produitId,
    )).toBe(false);

    const autresVentes = await autrePage.request.get(`${API}/pharmacien/ventes`);
    expect((await autresVentes.json()).data.some(
      (item: { id: string }) => item.id === vente.id,
    )).toBe(false);
  } finally {
    await autreContexte.close();
  }

  await page.goto('/pharmacien/stocks');
  await expect(page.locator('.bb-page-head__title')).toBeVisible();
  await expect(page.locator('.bb-ph-stocks__card-nom', { hasText: libelleProduit })).toBeVisible();

  await page.goto('/pharmacien/caisse');
  await expect(page.locator('.bb-page-head__title')).toBeVisible();
  await expect(page.locator('select#c-med-0 option', { hasText: libelleProduit })).toHaveCount(1);

  await page.goto('/pharmacien/agents');
  await expect(page.locator('.bb-page-head__title')).toBeVisible();
  await expect(page.locator('.bb-agents__list')).toContainText(emailAgent);

  await page.goto('/pharmacien/connexions');
  await expect(page.locator('.bb-page-head__title')).toBeVisible();
  await expect(page.locator('.bb-connexions__table')).toContainText(emailAgent);

  await page.goto('/pharmacien/tableau-de-bord');
  await expect(page.locator('.bb-page-head__title')).toBeVisible();
});
