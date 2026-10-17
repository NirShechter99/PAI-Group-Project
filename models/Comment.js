const mongoose = require("mongoose");

// Define the schema for the Comment model
const commentSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      default: "Guest",
    },
    content: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,
  },
);

// Compile and export the model
commentSchema.index({ article: 1, createdAt: -1 });
module.exports = mongoose.model("Comment", commentSchema);
