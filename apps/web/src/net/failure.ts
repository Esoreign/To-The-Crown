/** Erreur d'appel réseau (REST ou RPC), avec le code `ErrorCodes` associé. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
