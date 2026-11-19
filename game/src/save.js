// Costa Serena — save.js
// localStorage: mission progress, cash, settings. Corrupt data is discarded,
// never crashes the boot.
const KEY = 'costa-serena-save-v1';
export class Save {
  constructor() {
    this.data = { cash: 0, missionIndex: 0, muted: false, bestCash: 0 };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') this.data = { ...this.data, ...parsed };
      }
    } catch (e) { /* corrupt save: start fresh */ }
  }
  write() {
    try {
      this.data.bestCash = Math.max(this.data.bestCash || 0, this.data.cash || 0);
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) { /* storage full/blocked: play on without saving */ }
  }
  reset() { this.data = { cash: 0, missionIndex: 0, muted: false, bestCash: 0 }; this.write(); }
}
