const { Server } = require('socket.io');
const appConfig = require('./app.config');

exports.setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: appConfig.FRONTEND_URL.replace(/\/$/, ''),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on('joinUserRoom', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`[SOCKET] User ${userId} joined their personal room`);
    });

    socket.on('joinConversation', (chatId) => {
      socket.leaveAll();
      socket.join(chatId);
      console.log(`[SOCKET] User ${socket.id} joined conversation ${chatId}`);
    });

    socket.on('leaveConversation', (chatId) => {
      socket.leave(chatId);
      console.log(`[SOCKET] User ${socket.id} left conversation ${chatId}`);
    });

    socket.on('typingStart', (data) => {
      socket.to(data.chatId).emit('userTyping', {
        userId: data.userId,
        userName: data.userName,
      });
    });

    socket.on('typingStop', (data) => {
      socket.to(data.chatId).emit('userStoppedTyping', {
        userId: data.userId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });

  global._io = io;
  console.log('[SOCKET] Socket.IO initialized successfully');
};
