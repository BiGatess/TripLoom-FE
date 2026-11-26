import type { AuthSession, UserProfile } from '@/api/contracts';
import { authService } from '@/features/auth/auth.service';

type SessionListener = (session: AuthSession) => void;

class SessionStore {
  private session: AuthSession = { authenticated: false, user: null };
  private initialized = false;
  private listeners = new Set<SessionListener>();

  get current(): AuthSession {
    return this.session;
  }

  get user(): UserProfile | null {
    return this.session.user;
  }

  get isAuthenticated(): boolean {
    return this.session.authenticated && this.session.user !== null;
  }

  async initialize(): Promise<AuthSession> {
    if (this.initialized) return this.session;
    return this.refresh();
  }

  async refresh(): Promise<AuthSession> {
    try {
      const next = await authService.getSession();
      this.initialized = true;
      this.setSession(next);
      return next;
    } catch {
      this.initialized = true;
      this.setSession({ authenticated: false, user: null });
      return this.session;
    }
  }

  setSession(next: AuthSession): void {
    this.session = next;
    this.listeners.forEach((fn) => fn(this.session));
  }

  updateUser(user: UserProfile): void {
    this.setSession({ authenticated: true, user });
  }

  clear(): void {
    this.setSession({ authenticated: false, user: null });
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const sessionStore = new SessionStore();
