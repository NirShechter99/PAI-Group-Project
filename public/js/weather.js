(() => {
  const box = document.getElementById("weather"),
    retry = document.getElementById("weather-retry"),
    location = document.getElementById("weather-location");
  if (!box) return;
  let busy = false,
    expiryTimer,
    controller,
    serial = 0;
  try {
    const saved = localStorage.getItem("weather-location");
    if ([...location.options].some((option) => option.value === saved)) location.value = saved;
  } catch {}
  function unavailable() {
    box.replaceChildren(
      dom("p", "muted", "מזג האוויר אינו זמין כרגע. ננסה שוב בקרוב."),
    );
    retry.hidden = false;
  }
  function condition(code, isDay) {
    if (code === 0)
      return [isDay ? "☀" : "☾", isDay ? "שמיים בהירים" : "לילה בהיר"];
    if (code <= 3) return ["☁", "מעונן חלקית"];
    if (code <= 48) return ["≋", "ערפל"];
    if (code >= 95) return ["ϟ", "סופות רעמים"];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86)
      return ["❄", "שלג"];
    return ["☂", "גשם"];
  }
  async function refresh(force = false) {
    if (busy && !force) return;
    controller?.abort();
    controller = new AbortController();
    const request = ++serial;
    const selected = location.value;
    busy = true;
    retry.disabled = true;
    try {
      const query = selected === "tel-aviv" ? "" : `?location=${encodeURIComponent(selected)}`;
      const { data } = await api(`/api/weather/current${query}`, { signal: controller.signal });
      if (request !== serial) return;
      if (data.locationId && data.locationId !== selected) throw new Error("Wrong weather location");
      const remaining = Date.parse(data.validUntil) - Date.now();
      if (remaining <= 0) throw new Error("Expired weather");
      const [icon, description] = condition(data.code, data.isDay);
      const row = dom("div", "weather-main");
      const symbol = dom("span", "weather-icon", icon);
      symbol.setAttribute("aria-hidden", "true");
      row.append(dom("strong", "temperature", `${data.temperature}°`), symbol);
      box.replaceChildren(
        dom("strong", "", data.city),
        row,
        dom("p", "muted", description),
        dom("p", "weather-time", `זמן הנתונים: ${formatDate(data.observedAt)}`),
      );
      retry.hidden = true;
      clearTimeout(expiryTimer);
      // Never keep an old number visible just because a tab remains open.
      expiryTimer = setTimeout(() => {
        unavailable();
        refresh();
      }, remaining);
    } catch (error) {
      if (request === serial && error.name !== "AbortError") unavailable();
    } finally {
      if (request === serial) {
        busy = false;
        retry.disabled = false;
      }
    }
  }
  retry.addEventListener("click", () => refresh());
  location.addEventListener("change", () => {
    clearTimeout(expiryTimer);
    box.replaceChildren(dom("p", "muted", "טוען מזג אוויר…"));
    retry.hidden = true;
    try { localStorage.setItem("weather-location", location.value); } catch {}
    refresh(true);
  });
  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
})();
