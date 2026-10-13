// Work continuity: the draft is saved in the background, nothing is lost on refresh or when the browser closes.
// Three layers of protection:
//   1. localStorage: saved instantly on every keystroke (works even offline)
//   2. fetch to the server: 1.5 seconds after the reporter stops typing, plus a retry every 10 seconds
//   3. sendBeacon: a last save when the page is closed or refreshed
(function () {
  const form = document.getElementById('article-form');
  if (!form || form.dataset.locked === 'true') return;

  const url = `/reporter/articles/${form.dataset.articleId}/autosave`;
  const storageKey = `article-draft-${form.dataset.articleId}`;
  const statusEl = document.getElementById('save-status');
  const FIELDS = ['title', 'category', 'mainImage', 'content'];

  let timer = null;
  let dirty = false;

  const getData = () => Object.fromEntries(FIELDS.map((f) => [f, form.elements[f].value]));
  const setStatus = (text) => { statusEl.textContent = text; };

  function saveLocal() {
    try { localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data: getData() })); } catch (e) {}
  }

  function clearLocal() {
    try { localStorage.removeItem(storageKey); } catch (e) {}
  }

  async function saveToServer() {
    if (!dirty) return;
    setStatus('שומר...');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getData())
      });
      if (res.status === 409) return setStatus('הכתבה אצל העורך, לא ניתן לשמור שינויים');
      if (res.status === 401) return setStatus('נותקת מהמערכת. הטיוטה שמורה במחשב שלך, התחברי מחדש');
      if (!res.ok) throw new Error(res.status);
      const { savedAt } = await res.json();
      dirty = false;
      clearLocal();
      setStatus('נשמר אוטומטית ב ' + new Date(savedAt).toLocaleTimeString('he-IL'));
    } catch (e) {
      setStatus('אין חיבור לשרת. הטיוטה שמורה במחשב שלך ותישלח שוב');
    }
  }

  // Restore from localStorage if it is newer than what the server has
  try {
    const local = JSON.parse(localStorage.getItem(storageKey) || 'null');
    const serverTime = form.dataset.serverSavedAt ? new Date(form.dataset.serverSavedAt).getTime() : 0;
    if (local && local.savedAt > serverTime) {
      FIELDS.forEach((f) => { if (local.data[f] !== undefined) form.elements[f].value = local.data[f]; });
      setStatus('שוחזרה טיוטה שלא הספיקה להישמר בשרת');
      dirty = true;
      saveToServer();
    }
  } catch (e) {}

  // Every change: save locally now, save to the server after a short pause
  FIELDS.forEach((f) => form.elements[f].addEventListener('input', () => {
    dirty = true;
    saveLocal();
    clearTimeout(timer);
    timer = setTimeout(saveToServer, 1500);
  }));

  // Safety net: retry every 10 seconds if something was not saved
  setInterval(saveToServer, 10000);

  // Last save when leaving the page
  window.addEventListener('pagehide', () => {
    if (!dirty) return;
    navigator.sendBeacon(url, new Blob([JSON.stringify(getData())], { type: 'application/json' }));
  });

  // When the form is submitted the server gets everything, no backup needed
  form.addEventListener('submit', () => { dirty = false; clearLocal(); });
})();