// Logical revisions order keystrokes independently of network arrival or clock skew.
(() => {
  const form = document.getElementById("article-form");
  if (!form || form.dataset.locked === "true") return;
  const fields = ["title", "category", "mainImage", "content"];
  const key = `draft-${form.dataset.userId}-${form.dataset.articleId}`;
  const status = document.getElementById("save-status");
  let revision = Number(form.dataset.draftClock) || 0;
  let savedRevision = revision,
    pending = null,
    timer,
    submitting = false;
  const data = () =>
    Object.fromEntries(fields.map((f) => [f, form.elements[f].value]));
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  function backup() {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ clock: revision, data: data() }),
      );
    } catch {}
  }
  async function save() {
    if (pending) return pending;
    if (revision === savedRevision) return;
    const snapshot = revision,
      values = data();
    status.textContent = "שומר…";
    pending = (async () => {
      try {
        const result = await api(
          `/reporter/articles/${form.dataset.articleId}/autosave`,
          {
            method: "POST",
            body: JSON.stringify({ ...values, draftClock: snapshot }),
          },
        );
        savedRevision = snapshot;
        if (revision === snapshot) {
          clear();
          status.textContent = `נשמר ב־${formatDate(result.savedAt)}`;
        } else status.textContent = "שומר את השינויים האחרונים…";
      } catch (error) {
        status.textContent =
          error.status === 401
            ? "יש להתחבר מחדש. הטיוטה שמורה במכשיר."
            : error.status === 409
              ? "קיימת גרסה חדשה בשרת. רעננו כדי להמשיך; הגיבוי המקומי נשמר."
              : "השמירה לא הושלמה. הטיוטה נשמרת במכשיר וננסה שוב.";
      } finally {
        pending = null;
      }
    })();
    return pending;
  }
  function restore(local) {
    fields.forEach((f) => {
      if (typeof local.data[f] === "string")
        form.elements[f].value = local.data[f];
    });
    revision = Math.max(revision, Number(local.clock) || 0) + 1;
    backup();
    save();
  }
  try {
    const local = JSON.parse(localStorage.getItem(key) || "null");
    if (local?.data) {
      const identical = fields.every(
        (f) => local.data[f] === form.elements[f].value,
      );
      if (identical) clear();
      else if (Number(local.clock) > revision) restore(local);
      else {
        // Never silently replace an editor's or another computer's newer version.
        status.textContent =
          "קיים גיבוי מקומי שונה. הגרסה העדכנית מהשרת מוצגת.";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button subtle";
        button.textContent = "שחזור הגיבוי המקומי";
        button.addEventListener("click", () => {
          restore(local);
          button.remove();
        });
        status.after(button);
      }
    }
  } catch {}
  fields.forEach((f) =>
    form.elements[f].addEventListener("input", () => {
      revision++;
      backup();
      clearTimeout(timer);
      timer = setTimeout(save, 700);
    }),
  );
  setInterval(() => {
    if (!submitting) save();
  }, 5000);
  function beacon() {
    if (revision !== savedRevision && !submitting)
      navigator.sendBeacon(
        `/reporter/articles/${form.dataset.articleId}/autosave`,
        new Blob(
          [
            JSON.stringify({
              ...data(),
              draftClock: revision,
              _csrf: csrfToken(),
            }),
          ],
          { type: "application/json" },
        ),
      );
  }
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
      return;
    }
    event.preventDefault();
    await save();
    submitting = true;
    setTimeout(() => form.requestSubmit(submitter), 0);
  });
})();
