// Costa Serena — save.js
// Progres tersimpan di localStorage: misi, cash, dan pengaturan suara.
// Semua akses dibungkus try/catch — penyimpanan yang rusak tidak boleh
// merusak permainan.
import { CFG } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function saveGameState(S) {
  try {
    const data = {
      version: 1,
      missionIndex: S.missionIndex || 0,
      cash: Math.floor(S.player.cash || 0),
      muted: !!(S.audio && S.audio.muted),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}
