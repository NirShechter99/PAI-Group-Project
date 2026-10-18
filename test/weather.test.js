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

test("weather caches each allowed city independently and shares overlapping requests per city", async () => {
  const calls = [];
  const clock = Date.parse("2026-10-18T12:04:00Z");
  const service = createWeatherService({
    now: () => clock,
    fetcher: async (url) => {
      calls.push(url);
      await new Promise(r => setTimeout(r, 5));
      return { ok: true, json: async () => ({ current: { temperature_2m: new URL(url).searchParams.get("latitude") === "31.7683" ? 18 : 25, weather_code: 0, is_day: 1, time: "2026-10-18T12:00" } }) };
    },
  });
  const [jerusalem, telAviv] = await Promise.all([
    Promise.all(Array.from({length: 25}, () => service.get("jerusalem"))),
    Promise.all(Array.from({length: 25}, () => service.get("tel-aviv"))),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(jerusalem[0].city, "ירושלים");
  assert.equal(jerusalem[0].temperature, 18);
  assert.equal(telAviv[0].city, "תל אביב");
  assert.equal(telAviv[0].temperature, 25);
  await service.get("jerusalem"); await service.get("tel-aviv");
  assert.equal(calls.length, 2);
  for (const invalid of ["constructor", "__proto__", "https://example.com", ["haifa"], null])
    await assert.rejects(service.get(invalid), e => e.status === 400);
  assert.equal(calls.length, 2, "invalid locations never contact the provider");
});

test("a provider failure in one city does not block another city's cache", async () => {
  let calls = 0;
  const service = createWeatherService({
    now: () => Date.parse("2026-10-18T12:04:00Z"),
    fetcher: async (url) => {
      calls++;
      if(new URL(url).searchParams.get("latitude") === "31.7683") throw new Error("Unavailable");
      return { ok: true, json: async () => ({ current: { temperature_2m: 25, weather_code: 0, is_day: 1, time: "2026-10-18T12:00" } }) };
    },
  });
  await assert.rejects(service.get("jerusalem"));
  assert.equal((await service.get("haifa")).city, "חיפה");
  await assert.rejects(service.get("jerusalem"));
  assert.equal(calls, 2);
});
