const axios = require('axios');

// ใส่ token ของคุณที่นี่ (เอาจาก localStorage ในเบราว์เซอร์)
const token = 'YOUR_TOKEN_HERE'; // เปลี่ยนเป็น token จริง

axios.get('http://localhost:5000/api/dashboard/summary', {
  headers: { Authorization: `Bearer ${token}` }
})
.then(res => {
  console.log('Dashboard API Response:');
  console.log('Service Status:', res.data.serviceStatus);
  console.log('\nFull response:', JSON.stringify(res.data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Response:', err.response.data);
  }
});
