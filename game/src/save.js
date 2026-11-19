// Costa Serena — save.js
// One job: persistence. Mission progress, cash, best times and settings
// survive between sessions in localStorage; a corrupt save never blocks
// the game — it falls back to a fresh start.
const KEY = 'costa-serena-save-v1';

export function loadSave() {
  const fresh = { cash: 0, unlocked: 1, completed: [], bestTimes: {}, muted: false, radio: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fresh;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      unlocked: typeof data.unlocked === 'number' ? data.unlocked : 1,
      completed: Array.isArray(data.completed) ? data.completed : [],
      bestTimes: data.bestTimes && typeof data.bestTimes === 'object' ? data.bestTimes : {},
      muted: !!data.muted,
      radio: data.radio !== false,
    };
  } catch {
    return fresh;
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: save.cash || 0,
      unlocked: save.unlocked || 1,
      completed: save.completed || [],
      bestTimes: save.bestTimes || {},
      muted: !!save.muted,
      radio: save.radio !== false,
    }));
  } catch {
    // Storage full or blocked: the game keeps running without saving.
  }
}
