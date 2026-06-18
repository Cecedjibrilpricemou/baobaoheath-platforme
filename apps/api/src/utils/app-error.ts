// ─── Classes d'erreurs personnalisées BaoBaoHealth ────────
// Permettent au middleware global de déterminer automatiquement
// le code HTTP et le format de réponse appropriés.

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource non trouvee') {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acces refuse — permissions insuffisantes') {
    super(message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifie') {
    super(message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Donnees invalides') {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit de donnees') {
    super(message, 409);
  }
}
