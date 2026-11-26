import { finishPageLoading, startPageLoading } from '@/shared/components/PageLoader';
import type { AccessPolicy } from './route-guards';
import { evaluateRouteAccess } from './route-guards';
import { sessionStore } from './session-store';

export interface RouteContext {
  path: string;
  fullPath: string;
  params: Record<string, string>;
  query: URLSearchParams;
  container: HTMLElement;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  onCleanup: (fn: () => void) => void;
}

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>;

export interface RouteDefinition {
  pattern: string;
  title: string;
  policy: AccessPolicy;
  handler: RouteHandler;
}

interface CompiledRoute extends RouteDefinition {
  regex: RegExp;
  paramNames: string[];
}

function compilePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const escaped = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const normalized = escaped === '' ? '^/$' : `^${escaped}/?$`;
  return { regex: new RegExp(normalized), paramNames };
}

export class AppRouter {
  private routes: CompiledRoute[] = [];
  private forbiddenHandler: ((ctx: RouteContext, reason: string) => void | Promise<void>) | null = null;
  private notFoundHandler: RouteHandler | null = null;
  private errorHandler: ((ctx: RouteContext, error: unknown) => void | Promise<void>) | null = null;
  private container: HTMLElement | null = null;
  private cleanups: Array<() => void> = [];
  private renderToken = 0;

  register(routes: RouteDefinition[]): void {
    this.routes = routes.map((r) => ({
      ...r,
      ...compilePattern(r.pattern),
    }));
  }

  setForbiddenHandler(handler: (ctx: RouteContext, reason: string) => void | Promise<void>): void {
    this.forbiddenHandler = handler;
  }

  setNotFoundHandler(handler: RouteHandler): void {
    this.notFoundHandler = handler;
  }

  setErrorHandler(handler: (ctx: RouteContext, error: unknown) => void | Promise<void>): void {
    this.errorHandler = handler;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    window.addEventListener('popstate', () => {
      void this.resolveCurrentLocation();
    });

    // Chặn click trên thẻ <a> nội bộ để điều hướng SPA mượt mà không tải lại trang
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.hasAttribute('download') || anchor.target === '_blank' || anchor.dataset.nativeLink === '1') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (/^https?:\/\//i.test(href)) {
        try {
          const url = new URL(href);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      event.preventDefault();
      anchor.dataset.navPending = '1';
      window.setTimeout(() => {
        delete anchor.dataset.navPending;
      }, 320);
      this.navigate(href);
    });

    void this.resolveCurrentLocation();
  }

  navigate(to: string, options?: { replace?: boolean }): void {
    const normalized = to.startsWith('/') ? to : `/${to}`;
    if (options?.replace) {
      window.history.replaceState({}, '', normalized);
    } else {
      window.history.pushState({}, '', normalized);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    void this.resolveCurrentLocation();
  }

  reloadCurrent(): void {
    void this.resolveCurrentLocation();
  }

  private runCleanups(): void {
    const list = this.cleanups;
    this.cleanups = [];
    for (const fn of list) {
      try {
        fn();
      } catch {
        // Ignore cleanup failure
      }
    }
  }

  async resolveCurrentLocation(): Promise<void> {
    if (!this.container) return;
    const token = ++this.renderToken;
    this.runCleanups();

    startPageLoading();
    try {
      await sessionStore.refresh();
      if (token !== this.renderToken) return;

      const pathname = window.location.pathname || '/';
      const search = window.location.search || '';
      const fullPath = `${pathname}${search}`;
      const query = new URLSearchParams(search);

      const onCleanup = (fn: () => void) => {
        if (token === this.renderToken) {
          this.cleanups.push(fn);
        } else {
          fn();
        }
      };

      for (const route of this.routes) {
        const match = pathname.match(route.regex);
        if (!match) continue;

        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = decodeURIComponent(match[idx + 1] ?? '');
        });

        const guard = evaluateRouteAccess(route.policy, sessionStore.user, fullPath);
        if (!guard.allowed) {
          if (guard.action === 'redirect-login') {
            this.navigate(guard.loginUrl, { replace: true });
            return;
          }
          if (guard.action === 'redirect-home') {
            this.navigate(guard.targetUrl, { replace: true });
            return;
          }
          document.title = 'Không đủ quyền truy cập — TripLoom';
          if (this.forbiddenHandler) {
            await this.forbiddenHandler(
              {
                path: pathname,
                fullPath,
                params,
                query,
                container: this.container,
                navigate: (to, opt) => this.navigate(to, opt),
                onCleanup,
              },
              guard.reason,
            );
          }
          return;
        }

        document.title = `${route.title} — TripLoom`;
        const routeCtx: RouteContext = {
          path: pathname,
          fullPath,
          params,
          query,
          container: this.container,
          navigate: (to, opt) => this.navigate(to, opt),
          onCleanup,
        };
        try {
          await route.handler(routeCtx);
        } catch (err) {
          if (this.errorHandler) {
            await this.errorHandler(routeCtx, err);
          }
        }
        return;
      }

      document.title = 'Không tìm thấy trang — TripLoom';
      if (this.notFoundHandler) {
        await this.notFoundHandler({
          path: pathname,
          fullPath,
          params: {},
          query,
          container: this.container,
          navigate: (to, opt) => this.navigate(to, opt),
          onCleanup,
        });
      }
    } finally {
      finishPageLoading();
    }
  }
}

export const router = new AppRouter();
