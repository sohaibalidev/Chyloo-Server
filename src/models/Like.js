const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "type", 
    },
    type: {
      type: String,
      enum: ["post", "comment"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

likeSchema.index({ userId: 1, targetId: 1, type: 1 }, { unique: true });
likeSchema.index({ targetId: 1, type: 1 });

module.exports = mongoose.model("Like", likeSchema);
