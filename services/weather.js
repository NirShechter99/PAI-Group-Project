const MAX_AGE = 15 * 60 * 1000;
// One cache and one in-flight provider call per Node process, independent of visitor count.
function createWeatherService({ fetcher = fetch, now = Date.now } = {}) {
  let cached = null,
    pending = null,
    retryAfter = 0;
  async function refresh() {
    try {
      const response = await fetcher(
        "https://api.open-meteo.com/v1/forecast?latitude=32.0853&longitude=34.7818&current=temperature_2m,weather_code,is_day&timezone=GMT",
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) throw new Error("Weather provider unavailable");
      const body = await response.json();
      const current = body.current;
      const observedAt = Date.parse(`${current?.time}Z`);
      const fetchedAt = now();
      if (
        !current ||
        !Number.isFinite(current.temperature_2m) ||
        !Number.isFinite(current.weather_code) ||
        !Number.isFinite(observedAt) ||
        observedAt > fetchedAt + 60000 ||
        fetchedAt - observedAt >= MAX_AGE
      )
        throw new Error("Weather data is missing or too old");
      cached = {
        temperature: Math.round(current.temperature_2m),
        code: current.weather_code,
        isDay: current.is_day === 1,
        city: "תל אביב",
        observedAt: new Date(observedAt).toISOString(),
        fetchedAt: new Date(fetchedAt).toISOString(),
        validUntil: new Date(
          Math.min(observedAt + MAX_AGE, fetchedAt + 10 * 60000),
        ).toISOString(),
      };
      retryAfter = 0;
      return cached;
    } catch (error) {
      retryAfter = now() + 30000;
      throw error;
    } finally {
      pending = null;
    }
  }
  return {
    async get() {
      if (cached && now() < Date.parse(cached.validUntil)) return cached;
      if (pending) return pending;
      if (now() < retryAfter)
        throw new Error("Weather provider retry cooldown");
      pending = refresh();
      return pending;
    },
  };
}
module.exports = { createWeatherService, weather: createWeatherService() };
