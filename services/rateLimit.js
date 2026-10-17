const RateLimit = require("../models/RateLimit");
// An atomic rolling window shared by all server processes, including after restart.
module.exports = async function reserve(key, maximum, windowMs) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  try {
    await RateLimit.updateOne(
      { _id: key },
      { $setOnInsert: { hits: [], expiresAt: new Date(now.getTime() + windowMs) } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const recent = {
    $filter: { input: "$hits", as: "hit", cond: { $gt: ["$$hit", cutoff] } },
  };
  return Boolean(
    await RateLimit.findOneAndUpdate(
      { _id: key, $expr: { $lt: [{ $size: recent }, maximum] } },
      [
        {
          $set: {
            hits: { $concatArrays: [recent, [now]] },
            expiresAt: new Date(now.getTime() + windowMs),
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    ),
  );
};
