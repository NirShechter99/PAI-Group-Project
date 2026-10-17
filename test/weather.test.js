const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createWeatherService } = require("../services/weather");
test("weather shares concurrent calls, caches fresh data and expires by provider time", async () => {
  let clock = Date.parse("2026-10-15T12:04:00Z"),
    calls = 0;
  const service = createWeatherService({
    now: () => clock,
    fetcher: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return {
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 25.4,
            weather_code: 0,
            is_day: 1,
            time: "2026-10-15T12:00",
          },
        }),
      };
    },
  });
  const values = await Promise.all(
    Array.from({ length: 50 }, () => service.get()),
  );
  assert.equal(calls, 1);
  assert.equal(values[0].temperature, 25);
  await service.get();
  assert.equal(calls, 1);
  clock = Date.parse("2026-10-15T12:16:00Z");
  await assert.rejects(service.get());
  assert.equal(calls, 2);
  await assert.rejects(service.get());
  assert.equal(calls, 2, "outage uses cooldown, not stale cache");
});
test("weather errors and malformed payloads are unavailable", async () => {
  for (const body of [
    { current: {} },
    {
      current: {
        temperature_2m: "25",
        weather_code: 0,
        time: "2026-10-15T12:00",
      },
    },
  ]) {
    const service = createWeatherService({
      fetcher: async () => ({ ok: true, json: async () => body }),
    });
    await assert.rejects(service.get());
  }
  const service = createWeatherService({
    fetcher: async () => ({ ok: false }),
  });
  await assert.rejects(service.get());
});
