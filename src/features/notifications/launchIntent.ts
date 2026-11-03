/** Durable Activity intent replay, independent of Expo Router's short initial-URL timeout. */
function launchRoute(value: string | null): string | null {
  if (!value) return null;
  let path = value;
  if (!value.startsWith('/')) {
    try {
      const url = new URL(value);
      if (url.protocol.toLowerCase() !== 'pushofficeapp:') return null;
      path = `${url.host}${url.pathname}`;
      if (!path.startsWith('/')) path = '/' + path;
    } catch { return null; }
  }
  path = path.split(/[?#]/, 1)[0];
  if (path === '/' || path === '/(tabs)' || path === '/(tabs)/') return '/(tabs)';
  if (path === '/calendar' || path === '/(tabs)/calendar') return '/calendar';
  if (path === '/briefing' || path === '/(tabs)/briefing') return '/briefing';
  const match = path.match(/^\/schedule\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return id && id.length <= 256 ? `/schedule/${encodeURIComponent(id)}` : null;
  } catch { return null; }
}
/** Expo owns other app destinations, but their newer intents must supersede this replay queue. */
function validSameAppIntent(value: string): boolean {
  if (!/^pushofficeapp:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    decodeURI(value); // URL accepts malformed percent escapes; do not treat those as valid new intents.
    return url.protocol.toLowerCase() === 'pushofficeapp:';
  } catch { return false; }
}
export function createLaunchIntentController(navigation: {currentPath(): string; replace(route: string): void}) {
  let localReady = false;
  let navigationReady = false;
  let revision = 0;
  let pending: string | null = null;
  let disposed = false;
  const flush = () => {
    if (disposed || !localReady || !navigationReady || !pending) return;
    const target = pending;
    pending = null;
    const current = navigation.currentPath();
    // Expo Router may already have handled this URL; don't create a second detail entry.
    if (target !== current && !(target === '/(tabs)' && current === '/')) navigation.replace(target);
  };
  return {
    receive(value: string) {
      const route = launchRoute(value);
      if (disposed || !route && !validSameAppIntent(value)) return;
      revision++;
      pending = route;
      flush();
    },
    setReadiness(ready: {localReady: boolean; navigationReady: boolean}) {
      localReady = ready.localReady;
      navigationReady = ready.navigationReady;
      flush();
    },
    async initialize(readInitialURL: () => Promise<string | null>, readLegacyResponse?: () => Promise<string | null>) {
      const initialRevision = revision;
      let value: string | null;
      try { value = await readInitialURL(); } catch { value = null; }
      if (disposed || revision !== initialRevision) return;
      let route = launchRoute(value);
      // Native same-app links, including destinations owned by Expo, supersede older responses.
      if (!route && readLegacyResponse && (!value || !validSameAppIntent(value))) route = launchRoute(await readLegacyResponse());
      if (disposed || revision !== initialRevision || !route) return;
      pending = route;
      flush();
    },
    dispose() { disposed = true; pending = null; },
  };
}
