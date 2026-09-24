import type { ApiError } from '@ttc/shared';
import { ApiFailure } from './failure';
import { WEB_MODE } from './mode';
import { browserApi } from './browser/api';

export { ApiFailure };

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (WEB_MODE) return browserApi<T>(method, path, body);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-requested-with': 'ttc',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, 'NETWORK', 'Serveur injoignable');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiFailure(res.status, err?.code ?? 'INTERNAL', err?.message ?? res.statusText);
  }
  return data as T;
}
