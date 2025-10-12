const mongoose = require("mongoose");
const config = require("./app.config");

let isConnected = false;

exports.connectDB = async () => {
  if (isConnected) return mongoose.connection;

  try {
    await mongoose.connect(config.MONGODB_URI, { dbName: config.DB_NAME });
    isConnected = true;
    console.log("[MONGO] Connection Established");
    return mongoose.connection;
  } catch (err) {
    console.error("[MONGO] Connection error:", err.message);
    process.exit(1);
  }
};

exports.getConnection = () => {
  if (!isConnected)
    throw new Error("Database not initialized. Call connectDB first.");
  return mongoose.connection;
};
