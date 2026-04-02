// Socket.io server setup for real-time notification
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
let ioInstance = null;

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.1.65:3000',
  'http://192.168.1.189:3000',
  'https://crm-smartidea.vercel.app',
];

function setupSocket(server) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        if (/^https:\/\/crm-smartidea[a-z0-9-]*\.vercel\.app$/.test(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authenticate socket connections via JWT
  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    // Join a user-specific room for targeted notifications
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }
  });
  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.io not initialized!');
  return ioInstance;
}

module.exports = { setupSocket, getIO };