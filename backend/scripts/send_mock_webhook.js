const axios = require('axios');
const argv = require('yargs').argv;

// Usage: node send_mock_webhook.js --url=http://localhost:5000/api/webhooks/easyslip --imageUrl=https://.../slip.jpg

async function main() {
  const url = argv.url || 'http://localhost:5000/api/webhooks/easyslip';
  const imageUrl = argv.imageUrl;
  if (!imageUrl) {
    console.error('Please provide --imageUrl');
    process.exit(1);
  }

  const body = {
    success: true,
    data: {
      transRef: `mock-${Date.now()}`,
      imageUrl,
      confidence: 0.92
    }
  };

  try {
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    console.log('Webhook sent, status:', res.status, res.data);
  } catch (e) {
    console.error('Send webhook failed:', e.message);
  }
}

main();
