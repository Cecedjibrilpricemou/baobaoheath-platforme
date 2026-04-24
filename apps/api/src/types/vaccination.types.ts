// ─── DTOs Vaccinations ────────────────────────────────────

export interface CreateVaccinationDto {
    idPatient: string;
    vaccinNom: string;
    codeEpi?: string;
    numeroLot?: string;
    siteInjection?: string;
    reaction?: string;
    dateProchaineD?: string;
}

export interface UpdateVaccinationDto {
    reaction?: string;
    urlCertificat?: string;
    dateProchaineD?: string;
}

export interface VaccinationFilters {
    idPatient?: string;
    vaccinNom?: string;
    page?: number;
    limit?: number;
}

export interface RappelVaccinationFilters {
    joursAvant?: number;
    prefecture?: string;
}