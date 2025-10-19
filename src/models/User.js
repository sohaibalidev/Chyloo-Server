const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    passwordHash: { type: String, required: true, minlength: 6 },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    bio: { type: String, maxlength: 160, default: '' },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    avatar: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'dark',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
