// Socket.io server setup for real-time notification
const { Server } = require('socket.io');
let ioInstance = null;

function setupSocket(server) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  ioInstance.on('connection', (socket) => {
    // สามารถเพิ่ม logic auth ได้ที่นี่
    // console.log('Socket connected:', socket.id);
  });
  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.io not initialized!');
  return ioInstance;
}

module.exports = { setupSocket, getIO };