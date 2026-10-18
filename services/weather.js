const MAX_AGE = 15 * 60 * 1000;
const locations = Object.freeze({
  "tel-aviv": { city: "תל אביב", latitude: 32.0853, longitude: 34.7818 },
  jerusalem: { city: "ירושלים", latitude: 31.7683, longitude: 35.2137 },
  haifa: { city: "חיפה", latitude: 32.794, longitude: 34.9896 },
  "beer-sheva": { city: "באר שבע", latitude: 31.252, longitude: 34.7915 },
  eilat: { city: "אילת", latitude: 29.5577, longitude: 34.9519 },
  tiberias: { city: "טבריה", latitude: 32.794, longitude: 35.5312 },
  nazareth: { city: "נצרת", latitude: 32.6996, longitude: 35.3035 },
  ashdod: { city: "אשדוד", latitude: 31.8044, longitude: 34.6553 },
});
// One cache and one in-flight provider call per supported city and Node process.
function createCityService({ fetcher, now }, location, locationId) {
  let cached = null,
    pending = null,
    retryAfter = 0;
  async function refresh() {
    try {
      const response = await fetcher(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,is_day&timezone=GMT`,
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
        city: location.city,
        locationId,
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
function createWeatherService({ fetcher = fetch, now = Date.now } = {}) {
  // Fixed allowlist also bounds cache size and prevents arbitrary provider requests.
  const cities = new Map();
  return {
    async get(locationId = "tel-aviv") {
      if (typeof locationId !== "string" || !Object.hasOwn(locations, locationId))
        throw Object.assign(new Error("Unsupported weather location"), { status: 400 });
      if (!cities.has(locationId))
        cities.set(locationId, createCityService({ fetcher, now }, locations[locationId], locationId));
      return cities.get(locationId).get();
    },
  };
}
module.exports = { locations, createWeatherService, weather: createWeatherService() };
