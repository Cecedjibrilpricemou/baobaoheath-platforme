import { randomUUID } from 'crypto';
import { ModePaiement } from '../types/paiement.types';

export interface PaymentProviderRequest {
  modePaiement: ModePaiement;
  montantGnf: number;
  numeroOperateur?: string;
}

export interface PaymentProviderResponse {
  referenceOperateur?: string;
  statut: 'EN_ATTENTE';
  provider: 'SIMULATION_ORANGE_MONEY' | 'SIMULATION_MTN_MOMO' | 'SIMULATION_ESPECES';
}

export async function initierPaiementSimule(
  request: PaymentProviderRequest
): Promise<PaymentProviderResponse> {
  if (request.modePaiement === 'ESPECES') {
    return { statut: 'EN_ATTENTE', provider: 'SIMULATION_ESPECES' };
  }

  if (!request.numeroOperateur) {
    throw new Error(
      request.modePaiement === 'ORANGE_MONEY'
        ? 'Numero Orange Money requis'
        : 'Numero MTN MoMo requis'
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  const prefix = request.modePaiement === 'ORANGE_MONEY' ? 'OM-SIM' : 'MTN-SIM';

  return {
    referenceOperateur: `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    statut: 'EN_ATTENTE',
    provider: request.modePaiement === 'ORANGE_MONEY'
      ? 'SIMULATION_ORANGE_MONEY'
      : 'SIMULATION_MTN_MOMO',
  };
}
