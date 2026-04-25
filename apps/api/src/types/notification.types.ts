// ─── DTOs Notifications ───────────────────────────────────

export type CanalNotification = 'SMS' | 'PUSH' | 'IN_APP';

export type TypeNotification =
    | 'RAPPEL_RENDEZ_VOUS'
    | 'REFERENCEMENT_ACCEPTE'
    | 'REFERENCEMENT_REFUSE'
    | 'ALERTE_STOCK'
    | 'RAPPEL_VACCINATION'
    | 'ORDONNANCE_SIGNEE'
    | 'NOUVEAU_MESSAGE'
    | 'ALERTE_VITALE';

export interface SendSmsDto {
    telephone: string;
    message: string;
}

export interface SendNotificationDto {
    idDestinataire: string;
    type: TypeNotification;
    titre: string;
    contenu: string;
    canal: CanalNotification;
    metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
    lu?: boolean;
    type?: TypeNotification;
    page?: number;
    limit?: number;
}