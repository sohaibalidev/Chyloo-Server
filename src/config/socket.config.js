const { Server } = require("socket.io");
const appConfig = require("./app.config");

exports.setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: appConfig.BASE_URL.replace(/\/$/, ""),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });

  global._io = io;
  console.log("[SOCKET] Socket.IO initialized successfully");
};
