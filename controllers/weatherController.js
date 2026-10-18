const { weather } = require("../services/weather");
exports.getWeather = async (req, res) => {
  try {
    res.json({ data: await weather.get(req.query.location) });
  } catch (error) {
    if (error.status === 400)
      return res.status(400).json({ message: "יש לבחור מיקום מתוך הרשימה." });
    res
      .set("Retry-After", "30")
      .status(503)
      .json({ message: "מזג האוויר אינו זמין כרגע. ננסה שוב בקרוב." });
  }
};
