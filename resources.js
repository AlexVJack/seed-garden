const storageKey = 'seed-garden-resources';

export function createResources(storage) {
  let stone = 0;
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (Number.isSafeInteger(saved?.stone) && saved.stone >= 0) stone = saved.stone;
  } catch { /* Storage may be unavailable or contain invalid data. */ }

  return {
    get stone() { return stone; },
    mineStone() {
      if (stone < Number.MAX_SAFE_INTEGER) stone += 1;
      try { storage.setItem(storageKey, JSON.stringify({ stone })); } catch { /* Keep resources for this visit. */ }
      return stone;
    },
  };
}
