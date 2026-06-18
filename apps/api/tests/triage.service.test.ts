import { evaluerTriage } from '../src/services/triage.service';

describe('triage.service', () => {
  it('detecte une urgence vitale avec SpO2 critique', () => {
    const result = evaluerTriage({
      symptomes: ['toux', 'dyspnee'],
      constantes: { spo2: 89 },
    });

    expect(result.urgence).toBe('URGENCE_VITALE');
    expect(result.alertes).toContain('Hypoxemie severe');
  });

  it('propose une hypothese de paludisme sur les symptomes compatibles', () => {
    const result = evaluerTriage({
      symptomes: ['fievre', 'frissons', 'cephalee'],
    });

    expect(result.hypotheses[0]?.pathologie).toBe('Paludisme suspect');
    expect(result.urgence).toBe('URGENT');
  });
});
