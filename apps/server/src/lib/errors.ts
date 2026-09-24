import { ErrorCodes, GameError, isGameError, type ErrorCode } from '@ttc/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends GameError {
  constructor(
    readonly status: number,
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
  }
}

const STATUS: Partial<Record<ErrorCode, number>> = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_GAME_MEMBER: 403,
  NOT_HOST: 403,
  NOT_FOUND: 404,
  GAME_NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  CHARACTER_TAKEN: 409,
  GAME_ALREADY_STARTED: 409,
  GAME_FULL: 409,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
};

export function statusFor(err: GameError): number {
  if (err instanceof HttpError) return err.status;
  return STATUS[err.code] ?? 400;
}

/** Gestionnaire d'erreurs uniforme : jamais de stack trace côté client. */
export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply): void {
  if (err instanceof ZodError) {
    void reply.status(400).send({ error: { code: ErrorCodes.VALIDATION_FAILED, message: 'Requête invalide', details: err.issues.map((i) => ({ path: i.path, message: i.message })) } });
    return;
  }
  if (isGameError(err)) {
    void reply.status(statusFor(err)).send({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  const fe = err as FastifyError;
  if (fe.statusCode === 429) {
    void reply.status(429).send({ error: { code: ErrorCodes.RATE_LIMITED, message: 'Trop de requêtes, réessayez plus tard.' } });
    return;
  }
  if (fe.validation || (fe.statusCode && fe.statusCode < 500)) {
    void reply.status(fe.statusCode ?? 400).send({ error: { code: ErrorCodes.VALIDATION_FAILED, message: 'Requête invalide' } });
    return;
  }
  req.log.error({ err }, 'Erreur interne');
  void reply.status(500).send({ error: { code: ErrorCodes.INTERNAL, message: 'Erreur interne du serveur' } });
}
