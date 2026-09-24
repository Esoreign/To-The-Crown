import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@ttc/shared';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://ttc:ttc@localhost:5432/tothecrown_test';

export async function startServer(extra: Record<string, string> = {}): Promise<{ app: FastifyInstance; url: string }> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/5',
    SESSION_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    APP_ORIGIN: 'http://localhost:5173',
    LOG_LEVEL: 'silent',
    DEV_TOOLS: 'true',
    TICK_MS: '40,20,10',
    AUTOSAVE_MIN_SECONDS: '1',
    REGISTER_LIMIT_PER_HOUR: '1000',
    ...extra,
  });
  const app = await buildApp(config);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const port = (app.server.address() as AddressInfo).port;
  await app.redis?.flushdb();
  return { app, url: `http://127.0.0.1:${port}` };
}

export class Client {
  cookie = '';
  constructor(readonly url: string) {}

  async req<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(this.url + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        'x-requested-with': 'ttc',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async register(name: string): Promise<{ id: string }> {
    const r = await this.req<{ user: { id: string } }>('POST', '/api/auth/register', {
      email: `${name.toLowerCase()}-${Date.now()}@test.local`,
      username: `${name}${Math.floor(Math.random() * 1e6)}`,
      password: 'motdepasse42',
    });
    if (r.status !== 201) throw new Error(`register ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.user;
  }

  socket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return io(this.url, { transports: ['websocket'], extraHeaders: { cookie: this.cookie }, forceNew: true, reconnection: false });
  }
}

export function once<T>(socket: Socket, event: string, timeout = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${event}`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

export function waitFor(pred: () => boolean, timeout = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (pred()) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('waitFor timeout'));
      }
    }, 20);
  });
}

export function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout ${event}`)), 10_000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}
