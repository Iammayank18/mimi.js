import type { ActionErrorInit, Problem, Suggestion } from './types';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * An error designed to be read by an AI agent: it says what went wrong,
 * how to fix the call, whether retrying helps, and what to call instead.
 */
export class ActionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fix?: string;
  readonly param?: string;
  readonly retriable: boolean;
  readonly retryAfter?: number;
  readonly suggest?: Suggestion[];
  readonly docs?: string;
  extra: Partial<Problem> = {};

  constructor(init: ActionErrorInit) {
    super(init.message ?? init.code);
    this.name = 'ActionError';
    this.code = init.code;
    this.status = init.status ?? 400;
    this.fix = init.fix;
    this.param = init.param;
    this.retriable = init.retriable ?? false;
    this.retryAfter = init.retryAfter;
    this.suggest = init.suggest;
    this.docs = init.docs;
  }

  toProblem(action?: string): Problem {
    return {
      type: `https://mimijs.dev/problems/${this.code.toLowerCase().replace(/_/g, '-')}`,
      title: TITLES[this.status] ?? 'Error',
      status: this.status,
      code: this.code,
      detail: this.message,
      ...(this.fix && { fix: this.fix }),
      ...(this.param && { param: this.param }),
      retriable: this.retriable,
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
      ...(this.suggest?.length && { suggest: this.suggest }),
      ...(this.docs && { docs: this.docs }),
      ...(action && { action }),
      ...this.extra,
    };
  }
}

/** Convert anything thrown by a handler into a safe Problem. 5xx details are never leaked. */
export function toProblem(err: unknown, action?: string): Problem {
  if (err instanceof ActionError) return err.toProblem(action);
  const status = Number((err as any)?.status ?? (err as any)?.statusCode ?? 500);
  const safe = status >= 400 && status < 500;
  return new ActionError({
    code: safe ? (err as any)?.code ?? 'REQUEST_FAILED' : 'INTERNAL_ERROR',
    status: Number.isFinite(status) ? status : 500,
    message: safe ? (err as Error)?.message : 'The server hit an unexpected error while running this action.',
    retriable: !safe,
    fix: safe ? undefined : 'Retry once with the same idempotency key. If it fails again, stop and report the error to the user.',
  }).toProblem(action);
}
