(() => {
  const form = document.getElementById("feed-filters"),
    container = document.getElementById("articles-container"),
    more = document.getElementById("load-more"),
    status = document.getElementById("feed-status");
  const categories = {
    Technology: "טכנולוגיה",
    Sports: "ספורט",
    Politics: "פוליטיקה",
    Economy: "כלכלה",
    Entertainment: "תרבות",
  };
  const categoryLinks = document.querySelectorAll(".site-nav a[data-category]");
  function highlightCategory() {
    categoryLinks.forEach((link) => {
      const selected = link.dataset.category === form.elements.category.value;
      link.classList.toggle("active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  let page = Number(more.dataset.page),
    pages = Number(more.dataset.pages),
    busy = false,
    controller,
    serial = 0,
    timer;
  function card(item) {
    const article = dom("article", "news-card");
    article.dataset.articleId = item._id;
    const url = `/api/articles/view/${encodeURIComponent(item._id)}`;
    const link = dom("a", "card-image");
    link.href = url;
    link.tabIndex = -1;
    link.setAttribute("aria-hidden", "true");
    const img = dom("img");
    img.src = (/^https:\/\//i.test(item.mainImage || "") || /^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(item.mainImage || ""))
      ? item.mainImage
      : "/images/news.svg";
    img.alt = "";
    img.loading = "lazy";
    link.append(img);
    const body = dom("div", "card-body"),
      kicker = dom("div", "card-kicker");
    kicker.append(dom("span", "", categories[item.category] || item.category));
    if (item.viewed) kicker.append(dom("span", "read-label", "כבר קראת"));
    const h2 = dom("h2"),
      title = dom("a", "", item.title);
    title.href = url;
    h2.append(title);
    const byline = dom("div", "byline");
    byline.append(
      dom("span", "", item.author),
      dom("time", "", formatDate(item.publishedAt)),
    );
    body.append(
      kicker,
      h2,
      dom("p", "excerpt", (item.content || "").slice(0, 155) + "…"),
      byline,
    );
    article.append(link, body);
    return article;
  }
  async function load(reset = false) {
    if (busy && !reset) return;
    if (!reset && page >= pages) return;
    controller?.abort();
    controller = new AbortController();
    const request = ++serial;
    busy = true;
    more.disabled = true;
    status.textContent = "טוען כתבות…";
    const params = new URLSearchParams(new FormData(form));
    params.set("page", reset ? 1 : page + 1);
    try {
      const data = await api(`/api/articles/public?${params}`, {
        signal: controller.signal,
      });
      if (request !== serial) return;
      highlightCategory();
      if (reset) container.replaceChildren();
      container.append(...data.articles.map(card));
      page = data.currentPage;
      pages = data.totalPages;
      document.getElementById("feed-count").textContent = `${data.total} כתבות`;
      more.hidden = page >= pages;
      status.textContent = data.total
        ? ""
        : "לא נמצאו כתבות. נסו לשנות את החיפוש.";
      if (reset) {
        params.delete("page");
        history.replaceState(null, "", `/?${params}`);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        status.textContent = "לא ניתן לטעון כתבות כרגע. לחצו כדי לנסות שוב.";
        more.hidden = false;
      }
    } finally {
      if (request === serial) {
        busy = false;
        more.disabled = false;
      }
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(timer);
    load(true);
  });
  categoryLinks.forEach((link) => link.addEventListener("click", (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    clearTimeout(timer);
    form.elements.q.value = "";
    form.elements.category.value = link.dataset.category;
    form.elements.viewed.value = "";
    form.elements.sort.value = "latest";
    load(true);
  }));
  form
    .querySelectorAll("select")
    .forEach((el) => el.addEventListener("change", () => load(true)));
  form.elements.q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(true), 350);
  });
  more.addEventListener("click", () => load(page >= pages));
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !busy && !more.hidden) load();
    },
    { rootMargin: "250px" },
  );
  observer.observe(document.getElementById("feed-end"));
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) load(true);
  });
})();
