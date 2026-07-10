const ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'>
      <rect width='100%' height='100%' fill='#262626'/>
      <text x='50%' y='50%' font-size='72' text-anchor='middle' dominant-baseline='middle'>🍽️</text>
    </svg>`
  );

const photoCache = new Map<string, string>();

function sessionStorageKey(dishId: string): string {
  return `unsplash:${dishId}`;
}

function readSessionCache(dishId: string): string | null {
  try {
    return sessionStorage.getItem(sessionStorageKey(dishId));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — safe to skip
    return null;
  }
}

function writeSessionCache(dishId: string, url: string): void {
  try {
    sessionStorage.setItem(sessionStorageKey(dishId), url);
  } catch {
    // sessionStorage unavailable or full — safe to skip, falls back to in-memory cache
  }
}

export async function getDishPhoto(dishId: string, query: string): Promise<string> {
  const memoryCached = photoCache.get(dishId);
  if (memoryCached) return memoryCached;

  // sessionStorage survives page reloads (unlike the in-memory Map above), so a dish
  // whose photo was already fetched this tab session never calls Unsplash again —
  // this is what keeps us under the free-tier rate limit (50 req/hour).
  const sessionCached = readSessionCache(dishId);
  if (sessionCached) {
    photoCache.set(dishId, sessionCached);
    return sessionCached;
  }

  if (!ACCESS_KEY) {
    photoCache.set(dishId, FALLBACK_IMAGE);
    return FALLBACK_IMAGE;
  }

  try {
    const foodQuery = `${query} food photography`;
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        foodQuery
      )}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } }
    );
    if (!res.ok) throw new Error(`Unsplash request failed: ${res.status}`);
    const data = await res.json();
    // "regular" (~1080px wide) instead of "small" (~400px) — small looked blurry once
    // stretched across a full-width, ~320-384px-tall card on any retina/high-DPI screen.
    const url: string | undefined = data.results?.[0]?.urls?.regular;
    if (!url) throw new Error("No Unsplash result for query");
    photoCache.set(dishId, url);
    writeSessionCache(dishId, url);
    return url;
  } catch {
    // Deliberately not cached in sessionStorage: a rate-limit or empty-result failure
    // now shouldn't permanently lock this dish to the placeholder for the whole session.
    photoCache.set(dishId, FALLBACK_IMAGE);
    return FALLBACK_IMAGE;
  }
}

export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}
