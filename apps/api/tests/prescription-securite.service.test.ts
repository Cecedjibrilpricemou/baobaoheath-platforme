// Securite de prescription (EF-05-05, EF-05-06).
//
// Une alerte manquee est une erreur clinique ; une alerte de trop est du bruit
// qui apprend au prescripteur a ne plus les lire. Les deux echecs comptent, et
// les tests ci-dessous couvrent les deux sens.
import { analyserPrescription, libellesCorrespondent, memeClasseAtc, normaliser } from '../src/services/prescription-securite.service';
import { NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    consultation: { findUnique: jest.fn() },
    medicament: { findUnique: jest.fn(), findFirst: jest.fn() },
    ligneOrdonnance: { findMany: jest.fn() },
    interactionMedicament: { findFirst: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    consultation: { findUnique: jest.Mock };
    medicament: { findUnique: jest.Mock; findFirst: jest.Mock };
    ligneOrdonnance: { findMany: jest.Mock };
    interactionMedicament: { findFirst: jest.Mock };
  };
};

type FicheMedicament = {
  id: string;
  libelle: string;
  categorie: 'MEDICAMENT' | 'LAIT_INFANTILE' | 'COSMETIQUE' | 'HYGIENE' | 'PARAPHARMACIE' | 'DISPOSITIF_MEDICAL' | 'COMPLEMENT_ALIMENTAIRE' | 'AUTRE';
  dci: string | null;
  nomCommercial: string | null;
  codeAtc: string | null;
  contreIndications: string[];
};

const AMOXICILLINE: FicheMedicament = {
  id: 'm-amox', libelle: 'Clamoxyl', categorie: 'MEDICAMENT',
  dci: 'Amoxicilline', nomCommercial: 'Clamoxyl',
  codeAtc: 'J01CA04', contreIndications: [],
};

/** Patient sans particularite ; chaque test ne surcharge que ce qu'il teste. */
function consultation(patient: { allergies?: string[]; maladiesChroniques?: string[] } = {}) {
  prisma.consultation.findUnique.mockResolvedValue({
    idPatient: 'p1',
    patient: {
      allergies: patient.allergies ?? [],
      maladiesChroniques: patient.maladiesChroniques ?? [],
    },
  });
}

function candidat(m: Partial<FicheMedicament> = {}) {
  prisma.medicament.findUnique.mockResolvedValue({ ...AMOXICILLINE, ...m });
}

/** Ce que le patient prend deja. */
function traitementsEnCours(...molecules: { dci: string | null; libelle?: string }[]) {
  prisma.ligneOrdonnance.findMany.mockResolvedValue(
    molecules.map((m) => ({ medicament: { dci: m.dci, libelle: m.libelle ?? m.dci ?? '' } }))
  );
}

beforeEach(() => {
  consultation();
  candidat();
  traitementsEnCours();
  prisma.medicament.findFirst.mockResolvedValue(null);
  prisma.interactionMedicament.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.resetAllMocks());

// ── Comparaison de libelles ──────────────────────────────────────────
describe('comparaison de libelles saisis a la main', () => {
  it('ignore accents et casse', () => {
    expect(normaliser('Pénicilline')).toBe('penicilline');
    expect(libellesCorrespondent('Pénicilline', 'penicilline')).toBe(true);
  });

  it('rapproche une mention noyee dans une phrase', () => {
    expect(libellesCorrespondent('allergie a la penicilline', 'Penicilline')).toBe(true);
  });

  // « fer » figure dans « fermeture » : sans seuil, tout se rapprocherait de
  // tout et les alertes deviendraient du bruit.
  it('n accepte pas de correspondance partielle sur un terme court', () => {
    expect(libellesCorrespondent('fer', 'fermeture')).toBe(false);
    expect(libellesCorrespondent('fer', 'Fer')).toBe(true);
  });

  it('reconnait la famille ATC au 4e niveau', () => {
    expect(memeClasseAtc('J01CA04', 'J01CF05')).toBe(true);
    expect(memeClasseAtc('J01CA04', 'N02BE01')).toBe(false);
    expect(memeClasseAtc(null, 'J01CA04')).toBe(false);
    expect(memeClasseAtc('J01', 'J01CA04')).toBe(false);
  });
});

// ── Allergies ────────────────────────────────────────────────────────
describe('allergies', () => {
  it('alerte quand la DCI figure parmi les allergies declarees', async () => {
    consultation({ allergies: ['Amoxicilline'] });

    const { alertes, motifRequis } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toEqual(expect.objectContaining({ type: 'ALLERGIE', niveau: 'CONTRE_INDICATION' }));
    expect(motifRequis).toBe(true);
  });

  it('alerte aussi sur le nom commercial', async () => {
    consultation({ allergies: ['clamoxyl'] });

    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(1);
  });

  // Un patient allergique a l'amoxicilline l'est a toute la famille : sans
  // cette regle, l'ampicilline passerait sans un mot.
  it('alerte sur la famille ATC quand la molecule allergene est connue', async () => {
    consultation({ allergies: ['Ampicilline'] });
    prisma.medicament.findFirst.mockResolvedValue({ codeAtc: 'J01CA01' });

    const { alertes } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes).toHaveLength(1);
    expect(alertes[0].detail).toMatch(/meme famille/i);
  });

  it('ne rapproche pas deux familles ATC differentes', async () => {
    consultation({ allergies: ['Paracetamol'] });
    prisma.medicament.findFirst.mockResolvedValue({ codeAtc: 'N02BE01' });

    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(0);
  });

  it('ne cherche pas de famille quand le candidat n a pas de code ATC', async () => {
    consultation({ allergies: ['Ampicilline'] });
    candidat({ codeAtc: null });

    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(0);
    expect(prisma.medicament.findFirst).not.toHaveBeenCalled();
  });

  it('ne dit rien pour un patient sans allergie declaree', async () => {
    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(0);
  });
});

// ── Contre-indications ───────────────────────────────────────────────
describe('contre-indications', () => {
  it('alerte quand une maladie chronique figure dans les contre-indications', async () => {
    consultation({ maladiesChroniques: ['Insuffisance renale chronique'] });
    candidat({ contreIndications: ['Insuffisance renale'] });

    const { alertes } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toEqual(expect.objectContaining({ type: 'CONTRE_INDICATION' }));
    // Le motif cite le libelle du dossier, pas seulement celui du referentiel.
    expect(alertes[0].detail).toContain('Insuffisance renale chronique');
  });

  it('ne dit rien si aucune maladie du dossier ne correspond', async () => {
    consultation({ maladiesChroniques: ['Asthme'] });
    candidat({ contreIndications: ['Insuffisance renale'] });

    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(0);
  });
});

// ── Interactions ─────────────────────────────────────────────────────
describe('interactions avec les traitements en cours', () => {
  it('alerte sur une interaction connue et reprend la conduite a tenir', async () => {
    traitementsEnCours({ dci: 'Methotrexate' });
    prisma.interactionMedicament.findFirst.mockResolvedValue({
      niveau: 'ASSOCIATION_DECONSEILLEE',
      description: 'Augmentation de la toxicite hematologique du methotrexate.',
      conduite: 'Surveiller la numeration formule sanguine.',
      source: 'Thesaurus ANSM',
    });

    const { alertes, motifRequis } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toEqual(expect.objectContaining({
      type: 'INTERACTION',
      niveau: 'ASSOCIATION_DECONSEILLEE',
      medicamentEnCause: 'Methotrexate',
      conduite: 'Surveiller la numeration formule sanguine.',
    }));
    expect(motifRequis).toBe(true);
  });

  // Le couple est stocke ordonne : la recherche doit trouver la paire quel que
  // soit le sens de la prescription.
  it('interroge le couple dans les deux sens', async () => {
    traitementsEnCours({ dci: 'Methotrexate' });

    await analyserPrescription('cons-1', 'm-amox');

    expect(prisma.interactionMedicament.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [
        { dciA: 'amoxicilline', dciB: 'methotrexate' },
        { dciA: 'methotrexate', dciB: 'amoxicilline' },
      ] },
    }));
  });

  it('ne compte pas deux fois la meme molecule prescrite sur deux ordonnances', async () => {
    traitementsEnCours({ dci: 'Methotrexate' }, { dci: 'methotrexate' });
    prisma.interactionMedicament.findFirst.mockResolvedValue({
      niveau: 'PRECAUTION', description: 'x', conduite: null, source: null,
    });

    expect((await analyserPrescription('cons-1', 'm-amox')).alertes).toHaveLength(1);
  });

  // Une ordonnance servie ou perimee ne dit rien de ce que le patient prend.
  it('ne regarde que les traitements encore en cours', async () => {
    await analyserPrescription('cons-1', 'm-amox');

    const { where } = prisma.ligneOrdonnance.findMany.mock.calls[0][0];
    expect(where.statut).toBe('EN_ATTENTE');
    expect(where.idMedicament).toEqual({ not: 'm-amox' });
    expect(where.ordonnance.valideJusquau).toEqual({ gte: expect.any(Date) });
    expect(where.ordonnance.consultation).toEqual({ idPatient: 'p1' });
  });
});

// ── Seuil du motif et restitution ────────────────────────────────────
describe('motif de depassement', () => {
  // Exiger un motif pour tout finirait en « RAS » systematique, et
  // l'information se perdrait.
  it("n'est pas requis pour une simple precaution", async () => {
    traitementsEnCours({ dci: 'Methotrexate' });
    prisma.interactionMedicament.findFirst.mockResolvedValue({
      niveau: 'PRECAUTION', description: 'Surveillance simple.', conduite: null, source: null,
    });

    const { alertes, motifRequis } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes).toHaveLength(1);
    expect(motifRequis).toBe(false);
  });

  it("n'est pas requis quand il n'y a aucune alerte", async () => {
    expect((await analyserPrescription('cons-1', 'm-amox')).motifRequis).toBe(false);
  });

  // Un prescripteur presse lit la premiere ligne : elle doit porter le pire.
  it('restitue les alertes de la plus grave a la plus legere', async () => {
    consultation({ allergies: ['Amoxicilline'] });
    traitementsEnCours({ dci: 'Methotrexate' });
    prisma.interactionMedicament.findFirst.mockResolvedValue({
      niveau: 'PRECAUTION', description: 'Surveillance simple.', conduite: null, source: null,
    });

    const { alertes } = await analyserPrescription('cons-1', 'm-amox');

    expect(alertes.map((a) => a.niveau)).toEqual(['CONTRE_INDICATION', 'PRECAUTION']);
  });
});

// ── Garde-fous ───────────────────────────────────────────────────────
describe('garde-fous', () => {
  it('404 sur une consultation inconnue', async () => {
    prisma.consultation.findUnique.mockResolvedValue(null);
    await expect(analyserPrescription('cons-x', 'm-amox')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('404 sur un medicament inconnu', async () => {
    prisma.medicament.findUnique.mockResolvedValue(null);
    await expect(analyserPrescription('cons-1', 'm-x')).rejects.toBeInstanceOf(NotFoundError);
  });

  // Depuis le 2026-10-01 le catalogue contient des articles non
  // medicamenteux. Les laisser entrer ici ferait comparer une allergie a une
  // DCI absente : le patient allergique a la penicilline ne serait pas alerte,
  // et personne ne verrait rien.
  it('refuse de prescrire un article non medicamenteux', async () => {
    consultation({ allergies: ['Amoxicilline'] });
    candidat({ id: 'a-lait', libelle: 'Lait Guigoz 1er age', categorie: 'LAIT_INFANTILE', dci: null, nomCommercial: null, codeAtc: null });

    await expect(analyserPrescription('cons-1', 'a-lait')).rejects.toBeInstanceOf(ValidationError);
    await expect(analyserPrescription('cons-1', 'a-lait')).rejects.toThrow(/Lait Guigoz 1er age/);
  });

  // La contrainte SQL autorise un article non medicamenteux a porter une DCI
  // (une creme peut citer sa molecule). C'est donc bien la categorie qui
  // decide, pas l'absence de DCI.
  it('refuse un article non medicamenteux meme s il porte une DCI', async () => {
    consultation({ allergies: ['Hydrocortisone'] });
    candidat({ id: 'a-creme', libelle: 'Creme apaisante', categorie: 'COSMETIQUE', dci: 'Hydrocortisone' });

    await expect(analyserPrescription('cons-1', 'a-creme')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse aussi un MEDICAMENT sans DCI, que la contrainte SQL interdit', async () => {
    consultation();
    candidat({ dci: null });
    await expect(analyserPrescription('cons-1', 'm-amox')).rejects.toBeInstanceOf(ValidationError);
  });

  it('nomme le produit par son libelle, pas par un repli sur la DCI', async () => {
    consultation({ allergies: ['Amoxicilline'] });
    candidat({ libelle: 'Clamoxyl 500mg', nomCommercial: null });

    const { alertes } = await analyserPrescription('cons-1', 'm-amox');
    expect(alertes[0]?.medicamentEnCause).toBe('Clamoxyl 500mg');
  });
});
