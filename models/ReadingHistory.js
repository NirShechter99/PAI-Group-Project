const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Article",
    required: true,
  },
});
schema.index({ deviceId: 1, article: 1 }, { unique: true });
module.exports = mongoose.model("ReadingHistory", schema);
