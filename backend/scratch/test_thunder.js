const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const THUNDER_API_KEY = process.env.THUNDER_API_KEY;
  const THUNDER_API_URL = process.env.THUNDER_API_URL || 'https://api.thunder.in.th/v1/verify';

  console.log('THUNDER_API_KEY:', THUNDER_API_KEY);
  console.log('THUNDER_API_URL:', THUNDER_API_URL);

  const filePath = path.join(__dirname, '../uploads/slips/1770085919469-864335466.png');
  if (!fs.existsSync(filePath)) {
    console.error('Test slip file not found at:', filePath);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append('file', blob, 'slip.jpg');

  try {
    const res = await fetch(THUNDER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${THUNDER_API_KEY}`,
        'x-api-key': THUNDER_API_KEY
      },
      body: formData
    });

    const result = await res.json();
    console.log('Status Code:', res.status);
    console.log('Response JSON:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
