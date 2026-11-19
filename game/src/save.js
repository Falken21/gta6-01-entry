// Costa Serena — save.js
// Progres tersimpan di localStorage: misi, cash, pengaturan.
const KEY = 'costa-serena-save-v1';

export function createSave() {
  let data = { missionIdx: 0, cash: 120, muted: false, radio: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = { ...data, ...parsed };
    }
  } catch (e) { /* penyimpanan rusak -> mulai baru */ }
  return {
    data,
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* abaikan */ }
    },
    reset() {
      data = { missionIdx: 0, cash: 120, muted: false, radio: true };
      this.write();
    },
  };
}
