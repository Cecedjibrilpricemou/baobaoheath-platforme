// ─── DTOs Patient ─────────────────────────────────────────

export interface CreatePatientDto {
    telephone: string;
    motDePasse: string;
    prenom: string;
    nom: string;
    dateNaissance: string;
    sexe: string;
    prefecture: string;
    sousPrefecture?: string;
    village?: string;
    groupeSanguin?: string;
    allergies?: string[];
    maladiesChroniques?: string[];
    urgenceNom?: string;
    urgenceTelephone?: string;
  }
  
  export interface UpdatePatientDto {
    prenom?: string;
    nom?: string;
    email?: string;
    langue?: string;
    photoUrl?: string;
    groupeSanguin?: string;
    allergies?: string[];
    maladiesChroniques?: string[];
    sousPrefecture?: string;
    village?: string;
    urgenceNom?: string;
    urgenceTelephone?: string;
  }
  
  export interface PatientFilters {
    prefecture?: string;
    page?: number;
    limit?: number;
    search?: string;
  }