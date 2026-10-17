// Plain canvas: time is a numeric axis. Publication markers are never rounded to hours.
(async () => {
  const canvas = document.getElementById("impactChart"),
    status = document.getElementById("chart-status");
  try {
    const { data, publications } = await api(
      `/api/analytics/article/${document.getElementById("analytics-source").dataset.article}`,
    );
    const points = data.map((d) => ({
      t: Date.parse(d.timeWindow),
      y: d.views,
    }));
    const events = publications.map((p) => Date.parse(p.publishedAt));
    function draw() {
      const width = canvas.clientWidth,
        height = canvas.clientHeight,
        ratio = devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      const left = 46,
        right = 18,
        top = 28,
        bottom = 55,
        w = width - left - right,
        h = height - top - bottom;
      const times = [...points.map((p) => p.t), ...events];
      if (!times.length) {
        status.textContent =
          "אין נתוני צפייה עדיין. כניסה לעמוד הכתבה תתחיל את האיסוף.";
        return;
      }
      const min = Math.min(...times),
        max = Math.max(min + 3600000, ...times),
        peak = Math.max(5, ...points.map((p) => p.y));
      const x = (t) => left + ((t - min) / (max - min)) * w,
        y = (v) => top + h - (v / peak) * h;
      ctx.font = "11px Arial";
      ctx.textAlign = "right";
      ctx.fillStyle = "#617079";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const value = (peak * i) / 4,
          py = y(value);
        ctx.strokeStyle = "#e2e7e8";
        ctx.beginPath();
        ctx.moveTo(left, py);
        ctx.lineTo(width - right, py);
        ctx.stroke();
        ctx.fillText(String(Math.round(value)), left - 8, py + 4);
      }
      if (points.length) {
        ctx.strokeStyle = "#245f7c";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((p, i) =>
          i ? ctx.lineTo(x(p.t), y(p.y)) : ctx.moveTo(x(p.t), y(p.y)),
        );
        ctx.stroke();
        points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(x(p.t), y(p.y), 3, 0, Math.PI * 2);
          ctx.fillStyle = "#245f7c";
          ctx.fill();
        });
      }
      ctx.strokeStyle = "#b3382b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      events.forEach((t, i) => {
        ctx.beginPath();
        ctx.moveTo(x(t), top);
        ctx.lineTo(x(t), height - bottom);
        ctx.stroke();
        ctx.fillStyle = "#b3382b";
        ctx.textAlign = "center";
        ctx.fillText(
          String(i + 1),
          Math.max(left + 6, Math.min(width - right - 6, x(t))),
          18,
        );
      });
      ctx.setLineDash([]);
      const ticks = width < 450 ? 2 : 4;
      ctx.fillStyle = "#617079";
      for (let i = 0; i <= ticks; i++) {
        const t = min + ((max - min) * i) / ticks;
        ctx.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
        const date = new Date(t);
        ctx.fillText(
          date.toLocaleTimeString("he-IL", {
            timeZone: "Asia/Jerusalem",
            hour: "2-digit",
            minute: "2-digit",
          }),
          x(t),
          height - 28,
        );
        ctx.fillText(
          date.toLocaleDateString("he-IL", {
            timeZone: "Asia/Jerusalem",
            day: "2-digit",
            month: "2-digit",
          }),
          x(t),
          height - 12,
        );
      }
    }
    new ResizeObserver(draw).observe(canvas);
    draw();
  } catch {
    status.textContent =
      "לא ניתן לטעון את הגרף. נתוני המקור זמינים בטבלה למטה.";
  }
})();
