// Costa Serena — save: mission progress, cash and settings in localStorage.
// Corrupt or out-of-range saves are discarded, never trusted (defect review).
const KEY = 'costa-serena-save-v1';

export function loadSave() {
  const fresh = { mission: 0, cash: 0, muted: false, best: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fresh;
    return {
      mission: Number.isInteger(data.mission) && data.mission >= 0 && data.mission <= 5 ? data.mission : 0,
      cash: Number.isFinite(data.cash) && data.cash >= 0 && data.cash < 1000000 ? Math.floor(data.cash) : 0,
      muted: data.muted === true,
      best: Number.isFinite(data.best) && data.best >= 0 ? data.best : 0,
    };
  } catch (e) {
    return fresh;
  }
}

export function writeSave(save) {
  try {
    const safe = {
      mission: Math.max(0, Math.min(5, save.mission | 0)),
      cash: Math.max(0, Math.min(999999, Math.floor(save.cash) || 0)),
      muted: save.muted === true,
      best: Math.max(0, save.best | 0),
    };
    localStorage.setItem(KEY, JSON.stringify(safe));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
