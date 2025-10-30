// Auto-config dev server for LAN access on Windows/Node
// - Binds React dev server to 0.0.0.0
// - Detects local IPv4 (private) address
// - Sets REACT_APP_API_URL to http://<lan-ip>:5000 so other devices can call backend

const os = require('os');

function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // prefer private ranges
        if (
          iface.address.startsWith('10.') ||
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('172.16.') || iface.address.startsWith('172.17.') ||
          iface.address.startsWith('172.18.') || iface.address.startsWith('172.19.') ||
          iface.address.startsWith('172.2') // covers 172.20 - 172.29
        ) {
          return iface.address;
        }
      }
    }
  }
  // fallback: first non-internal IPv4
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const ip = getLanIP();
process.env.HOST = '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';
// Allow override via existing env (manual), else use detected IP
if (!process.env.REACT_APP_API_URL) {
  process.env.REACT_APP_API_URL = `http://${ip}:5000`;
}

console.log('Starting React dev server for LAN...');
console.log('HOST       =', process.env.HOST);
console.log('PORT       =', process.env.PORT);
console.log('API (env)  =', process.env.REACT_APP_API_URL);
console.log('LAN IP     =', ip);

require('react-scripts/scripts/start');
