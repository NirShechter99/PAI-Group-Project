"use strict";
window.csrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content || "";
window.api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken(),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "הפעולה נכשלה");
    error.status = response.status;
    throw error;
  }
  return data;
};
window.dom = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
window.formatDate = (value) =>
  new Date(value).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
    timeStyle: "short",
  });
document.addEventListener(
  "error",
  (event) => {
    if (
      event.target.tagName === "IMG" &&
      !event.target.src.endsWith("/images/news.svg")
    )
      event.target.src = "/images/news.svg";
  },
  true,
);
// Catch images that failed before this deferred script ran.
document.querySelectorAll("img").forEach((img) => {
  if (img.complete && !img.naturalWidth) img.src = "/images/news.svg";
});
document.querySelectorAll("form[data-confirm]").forEach((form) =>
  form.addEventListener("submit", (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  }),
);
document.getElementById("logout")?.addEventListener("click", async (event) => {
  event.target.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    location.assign("/");
  } catch (error) {
    event.target.disabled = false;
    alert(error.message);
  }
});
