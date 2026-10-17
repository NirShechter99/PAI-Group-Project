(() => {
  const picker = document.getElementById("image-file");
  if (!picker) return;
  const form = document.getElementById("article-form");
  const field = form.elements.mainImage;
  const status = document.getElementById("image-status");
  let busy = false;
  form.addEventListener("submit", (event) => {
    if (busy) { event.preventDefault(); status.textContent = "יש להמתין לסיום העלאת התמונה"; }
  }, true);
  picker.addEventListener("change", async () => {
    const file = picker.files[0];
    if (!file || busy) return;
    if (file.size > 3 * 1024 * 1024) { status.textContent = "גודל התמונה המרבי הוא 3MB"; return; }
    busy = true;
    picker.disabled = true;
    status.textContent = "מעלה תמונה…";
    try {
      const data = new FormData();
      data.append("image", file);
      const response = await fetch(`/reporter/articles/${form.dataset.articleId}/image`, {
        method: "POST", headers: { "X-CSRF-Token": csrfToken() }, body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Upload failed");
      field.value = result.url;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "התמונה הועלתה; השמירה האוטומטית מעדכנת את הטיוטה";
    } catch { status.textContent = "ההעלאה נכשלה. יש לבחור PNG, JPEG או WebP עד 3MB ולנסות שוב."; }
    finally { busy = false; picker.disabled = false; picker.value = ""; }
  });
  document.getElementById("remove-image").addEventListener("click", () => {
    if (busy) return;
    field.value = "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    status.textContent = "התמונה הוסרה מהטיוטה. לפרסום נדרשת תמונה ראשית.";
  });
})();
