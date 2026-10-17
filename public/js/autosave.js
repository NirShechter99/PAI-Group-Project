// A single request at a time plus revision tracking prevents an older response
// from clearing changes typed while that request was in flight.
(() => {
  const form = document.getElementById("article-form");
  if (!form || form.dataset.locked === "true") return;
  const fields = ["title", "category", "mainImage", "content"];
  const key = `draft-${form.dataset.userId}-${form.dataset.articleId}`;
  const status = document.getElementById("save-status");
  let revision = 0,
    savedRevision = 0,
    pending = null,
    timer,
    submitting = false;
  const data = () =>
    Object.fromEntries(fields.map((f) => [f, form.elements[f].value]));
  const backup = () => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ at: Date.now(), data: data() }),
      );
    } catch {}
  };
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  async function save() {
    if (pending) return pending;
    if (revision === savedRevision) return;
    const snapshot = revision;
    status.textContent = "שומר…";
    pending = (async () => {
      try {
        const result = await api(
          `/reporter/articles/${form.dataset.articleId}/autosave`,
          { method: "POST", body: JSON.stringify(data()) },
        );
        savedRevision = snapshot;
        if (revision === snapshot) clear();
        status.textContent = `נשמר ב־${formatDate(result.savedAt)}`;
      } catch (error) {
        status.textContent =
          error.status === 401
            ? "יש להתחבר מחדש. הטיוטה שמורה במכשיר."
            : error.status === 409
              ? "הכתבה בבדיקה או עודכנה. רעננו כדי לבדוק."
              : "השמירה לא הושלמה. הטיוטה נשמרת במכשיר וננסה שוב.";
      } finally {
        pending = null;
      }
    })();
    return pending;
  }
  try {
    const local = JSON.parse(localStorage.getItem(key) || "null");
    if (local && local.at > Date.parse(form.dataset.serverSavedAt)) {
      fields.forEach((f) => {
        if (typeof local.data[f] === "string")
          form.elements[f].value = local.data[f];
      });
      revision++;
      save();
    }
  } catch {}
  fields.forEach((f) =>
    form.elements[f].addEventListener("input", () => {
      revision++;
      backup();
      clearTimeout(timer);
      timer = setTimeout(save, 1000);
    }),
  );
  setInterval(() => {
    if (!submitting) save();
  }, 10000);
  const beacon = () => {
    if (revision !== savedRevision && !submitting)
      navigator.sendBeacon(
        `/reporter/articles/${form.dataset.articleId}/autosave`,
        new Blob([JSON.stringify({ ...data(), _csrf: csrfToken() })], {
          type: "application/json",
        }),
      );
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) beacon();
  });
  window.addEventListener("pagehide", beacon);
  form.addEventListener("submit", async (event) => {
    if (submitting) return;
    const submitter = event.submitter;
    clearTimeout(timer);
    if (!pending && revision === savedRevision) {
      submitting = true;
      return; // Already saved: allow the original browser submission.
    }
    event.preventDefault();
    await save();
    // Retain a local backup if the navigation fails. Successful server saves have a newer timestamp.
    submitting = true;
    // Let the current submit event finish before submitting again.
    setTimeout(() => form.requestSubmit(submitter), 0);
  });
})();
