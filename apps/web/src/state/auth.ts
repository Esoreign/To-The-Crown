import { create } from 'zustand';
import type { PublicUser } from '@ttc/shared';
import { api } from '../net/api';

interface AuthState {
  user: PublicUser | null;
  checked: boolean;
  check(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(email: string, username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  checked: false,
  async check() {
    try {
      const r = await api<{ user: PublicUser | null }>('GET', '/api/auth/session');
      set({ user: r.user, checked: true });
    } catch {
      set({ user: null, checked: true });
    }
  },
  async login(email, password) {
    const r = await api<{ user: PublicUser }>('POST', '/api/auth/login', { email, password });
    set({ user: r.user });
  },
  async register(email, username, password) {
    const r = await api<{ user: PublicUser }>('POST', '/api/auth/register', { email, username, password });
    set({ user: r.user });
  },
  async logout() {
    await api('POST', '/api/auth/logout').catch(() => undefined);
    set({ user: null });
  },
}));
