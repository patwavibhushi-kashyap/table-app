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

export async function getDishPhoto(dishId: string, query: string): Promise<string> {
  const cached = photoCache.get(dishId);
  if (cached) return cached;

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
    const url: string = data.results?.[0]?.urls?.small ?? FALLBACK_IMAGE;
    photoCache.set(dishId, url);
    return url;
  } catch {
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
