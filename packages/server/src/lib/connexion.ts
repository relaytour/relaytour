// Durée de validité d'un code de connexion. Partagée par Better Auth (auth.ts) et par
// le worker, qui n'envoie pas un code déjà expiré.
export const CODE_VALIDITE_SECONDES = 10 * 60
