import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const deviceModeInitScript = `(() => {
  try {
    const html = document.documentElement;
    const mode = localStorage.getItem('rally.device-mode') || 'auto';
    const validMode = ['auto', 'mobile', 'tablet', 'desktop'].includes(mode) ? mode : 'auto';
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const dpr = window.devicePixelRatio || 1;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const noFinePointer = window.matchMedia && window.matchMedia('(hover: none)').matches;
    const touch = coarse || maxTouchPoints > 0;
    const screenW = (window.screen && window.screen.width) || window.innerWidth;
    const screenH = (window.screen && window.screen.height) || window.innerHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const longSide = Math.max(screenW, screenH);
    const shortSide = Math.min(screenW, screenH);
    const cssShortSide = Math.min(shortSide, viewportW, viewportH);
    const physicalLongSide = Math.max(screenW * dpr, screenH * dpr, viewportW * dpr, viewportH * dpr);
    const physicalShortSide = cssShortSide * dpr;
    const iPadLike = /iPad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const androidTablet = /Android/i.test(ua) && (!/Mobile/i.test(ua) || /Lenovo|TB-|Tab|Tablet/i.test(ua));
    const largeTouchScreen = touch && longSide >= 900 && shortSide >= 560;
    const wuxgaTouchScreen = touch && noFinePointer && cssShortSide >= 560 && physicalLongSide >= 1600 && physicalShortSide >= 1000;
    const isTablet = iPadLike || androidTablet || largeTouchScreen || wuxgaTouchScreen;
    const resolved = validMode === 'auto' ? (isTablet ? 'tablet' : (window.innerWidth < 768 ? 'mobile' : (coarse ? 'tablet' : 'desktop'))) : validMode;
    html.classList.remove('device-mobile', 'device-tablet', 'device-desktop', 'force-landscape');
    html.classList.add('device-' + resolved);
    html.dataset.deviceMode = validMode;
    html.dataset.deviceResolved = resolved;
  } catch (_) {}
})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "vstats" },
      { name: "description", content: "Volley Stats Live: Real-time volleyball statistics and league management." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "vstats" },
      { property: "og:description", content: "Volley Stats Live: Real-time volleyball statistics and league management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "vstats" },
      { name: "twitter:description", content: "Volley Stats Live: Real-time volleyball statistics and league management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/799c247b-3d7a-4bf9-8f99-0581884c1137" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/799c247b-3d7a-4bf9-8f99-0581884c1137" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: deviceModeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void import("../hooks/use-device-mode").then((m) => {
      cleanup = m.initDeviceMode();
    });
    return () => cleanup?.();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

