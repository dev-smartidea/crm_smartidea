// Script to update pageUrl for upcoming services in MongoDB
// Usage: node update-upcoming-services-pageurl.js

const mongoose = require('mongoose');
const Service = require('./models/Service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/YOUR_DB_NAME';

async function main() {
  await mongoose.connect(MONGO_URI);
  const today = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(today.getDate() + 7);

  // Find upcoming services (due in next 7 days)
  const services = await Service.find({
    dueDate: { $lte: sevenDaysLater, $gte: today }
  });

  for (const svc of services) {
    // Example: set pageUrl if empty
    if (!svc.pageUrl || svc.pageUrl === '-') {
      // You can customize this logic per service/customer
      svc.pageUrl = 'https://example.com'; // <-- Replace with actual URL or logic
      await svc.save();
      console.log(`Updated service ${svc._id} with pageUrl: ${svc.pageUrl}`);
    }
  }

  console.log('Done updating upcoming services.');
  mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
});
