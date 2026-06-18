interface TriageInput {
  ageAnnees?: number;
  symptomes: string[];
  constantes?: {
    temperature?: number;
    spo2?: number;
    frequenceRespiratoire?: number;
    frequenceCardiaque?: number;
    tensionSystolique?: number;
    glycemie?: number;
  };
}

interface TriageRule {
  pathologie: string;
  score: number;
  signes: string[];
  conduite: string;
  urgence: 'ROUTINE' | 'URGENT' | 'URGENCE_VITALE';
}

const RULES: Array<{
  pathologie: string;
  keywords: string[];
  conduite: string;
  urgence: TriageRule['urgence'];
}> = [
  { pathologie: 'Paludisme suspect', keywords: ['fievre', 'frissons', 'cephalee', 'vomissement'], conduite: 'Test rapide paludisme, hydratation, surveillance temperature.', urgence: 'URGENT' },
  { pathologie: 'Infection respiratoire aigue suspecte', keywords: ['toux', 'dyspnee', 'respiration rapide', 'douleur thoracique'], conduite: 'Mesurer SpO2, rechercher signes de pneumonie, referer si detresse.', urgence: 'URGENT' },
  { pathologie: 'Diarrhee/deshydratation suspecte', keywords: ['diarrhee', 'vomissement', 'soif', 'deshydratation'], conduite: 'SRO, evaluer signes de deshydratation severe.', urgence: 'URGENT' },
  { pathologie: 'Hypertension severe suspecte', keywords: ['cephalee', 'vertige', 'vision trouble'], conduite: 'Controle tensionnel repete, referencement si TA tres elevee.', urgence: 'URGENT' },
  { pathologie: 'Diabete desequilibre suspect', keywords: ['polyurie', 'soif', 'fatigue', 'amaigrissement'], conduite: 'Mesurer glycemie, referer si glycemie critique ou signes neurologiques.', urgence: 'URGENT' },
  { pathologie: 'Grossesse a risque suspecte', keywords: ['grossesse', 'saignement', 'douleur abdominale', 'oedeme'], conduite: 'Evaluer urgence obstetricale, referer vers structure adaptee.', urgence: 'URGENCE_VITALE' },
  { pathologie: 'Malnutrition suspecte', keywords: ['amaigrissement', 'oedeme', 'fatigue', 'enfant maigre'], conduite: 'Mesurer poids, taille, perimetre brachial, referer selon protocole nutrition.', urgence: 'URGENT' },
  { pathologie: 'Dermatose/infection cutanee suspecte', keywords: ['plaie', 'eruption', 'demangeaison', 'pus'], conduite: 'Soins locaux, verifier signes infectieux et vaccination tetanos.', urgence: 'ROUTINE' },
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function evaluerTriage(input: TriageInput) {
  const symptomes = input.symptomes.map(normalize);
  const constantes = input.constantes ?? {};

  const rules: TriageRule[] = RULES.map((rule) => {
    const signes = rule.keywords.filter((keyword) =>
      symptomes.some((symptome) => symptome.includes(normalize(keyword)))
    );

    return {
      pathologie: rule.pathologie,
      score: signes.length,
      signes,
      conduite: rule.conduite,
      urgence: rule.urgence,
    };
  })
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const alertes: string[] = [];
  if (constantes.temperature && constantes.temperature >= 40) alertes.push('Fievre tres elevee');
  if (constantes.spo2 && constantes.spo2 < 92) alertes.push('Hypoxemie severe');
  if (constantes.frequenceRespiratoire && constantes.frequenceRespiratoire > 50) alertes.push('Tachypnee severe');
  if (constantes.tensionSystolique && constantes.tensionSystolique >= 180) alertes.push('Tension arterielle tres elevee');
  if (constantes.glycemie && constantes.glycemie > 3) alertes.push('Glycemie critique');

  const urgence =
    alertes.length > 0 || rules.some((rule) => rule.urgence === 'URGENCE_VITALE')
      ? 'URGENCE_VITALE'
      : rules.some((rule) => rule.urgence === 'URGENT')
        ? 'URGENT'
        : 'ROUTINE';

  return {
    moteur: 'REGLES_ASC_V1',
    urgence,
    alertes,
    hypotheses: rules.slice(0, 5),
    recommandation: urgence === 'URGENCE_VITALE'
      ? 'Referer immediatement vers une structure adaptee.'
      : 'Completer examen ASC, documenter constantes et suivre protocole local.',
    avertissement: 'Outil d aide a la decision. Ne remplace pas le jugement clinique.',
  };
}
