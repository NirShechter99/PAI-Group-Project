(() => {
  const section = document.querySelector(".comments"),
    form = document.getElementById("comment-form"),
    list = document.getElementById("comments-list"),
    status = document.getElementById("comment-status"),
    more = document.getElementById("more-comments");
  const seen = new Set();
  let page = 0,
    busy = false;
  function render(c) {
    const item = dom("article", "comment"),
      header = dom("header");
    header.append(
      dom("strong", "", c.authorName),
      dom("time", "", formatDate(c.createdAt)),
    );
    item.append(header, dom("p", "", c.content));
    return item;
  }
  async function load() {
    if (busy) return;
    busy = true;
    more.disabled = true;
    try {
      const data = await api(
        `/api/comments/article/${section.dataset.article}?page=${page + 1}`,
      );
      page++;
      data.comments.forEach((c) => {
        if (!seen.has(c._id)) {
          seen.add(c._id);
          list.append(render(c));
        }
      });
      more.hidden = !data.hasMore;
    } catch {
      status.textContent = "לא ניתן לטעון תגובות כרגע.";
      more.hidden = false;
    } finally {
      busy = false;
      more.disabled = false;
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "מפרסם…";
    try {
      const data = await api("/api/comments/create", {
        method: "POST",
        body: JSON.stringify({
          article: section.dataset.article,
          ...Object.fromEntries(new FormData(form)),
        }),
      });
      list.prepend(render(data.comment));
      seen.add(data.comment._id);
      form.elements.content.value = "";
      status.textContent = "התגובה פורסמה";
    } catch (error) {
      status.textContent = error.message;
      if (error.status === 429) {
        setTimeout(() => {
          button.disabled = false;
          status.textContent = "אפשר לנסות לפרסם תגובה נוספת.";
        }, 60000);
        return;
      }
    }
    button.disabled = false;
  });
  more.addEventListener("click", load);
  load();
})();
