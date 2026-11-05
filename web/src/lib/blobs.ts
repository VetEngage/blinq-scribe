// Blob URLs made from files fetched with the auth header. Photos are cached so redraws don't refetch;
// everything is revoked at sign out.
const photos = new Map<string, Promise<string>>();
const open = new Set<string>();

export function cachedPhoto(key: string, load: () => Promise<string>): Promise<string> {
  let p = photos.get(key);
  if (!p) {
    p = load().catch(() => "");
    photos.set(key, p);
  }
  return p;
}

export const keepBlob = (url: string): void => {
  open.add(url);
};

export function revokeAllBlobs(): void {
  photos.forEach((p) => void p.then((u) => u && URL.revokeObjectURL(u)));
  photos.clear();
  open.forEach((u) => URL.revokeObjectURL(u));
  open.clear();
}

/**
 * Files open in a new tab from a blob URL. The tab opens inside the click so popup blockers allow it,
 * then gets the file once it arrives. Without a tab, the caller gets a link to show instead.
 */
export async function openBlob(load: () => Promise<string>): Promise<{ fallbackUrl?: string }> {
  const w = window.open("", "_blank");
  try {
    const url = await load();
    if (w) {
      showBlob(w, url);
      return {};
    }
    keepBlob(url);
    return { fallbackUrl: url };
  } catch (err) {
    if (w) w.close();
    throw err;
  }
}

export function showBlob(w: Window, url: string): void {
  w.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000); // the tab has loaded it by then
}
