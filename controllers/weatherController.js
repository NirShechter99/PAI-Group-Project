const { weather } = require("../services/weather");
exports.getWeather = async (req, res) => {
  try {
    res.json({ data: await weather.get() });
  } catch {
    res
      .set("Retry-After", "30")
      .status(503)
      .json({ message: "מזג האוויר אינו זמין כרגע. ננסה שוב בקרוב." });
  }
};
