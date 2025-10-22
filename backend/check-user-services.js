const mongoose = require('mongoose');
const Service = require('./models/Service');

mongoose.connect('mongodb://localhost:27017/crm_smartidea').then(async () => {
  console.log('Connected to MongoDB');
  
  const all = await Service.find();
  console.log('\nAll services with userId:');
  all.forEach(s => {
    console.log(`- ${s.name} (${s.status}): userId = ${s.userId || 'NO USER ID'}`);
  });
  
  const withoutUserId = all.filter(s => !s.userId);
  console.log(`\nServices without userId: ${withoutUserId.length}`);
  
  const statusCounts = {};
  all.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });
  
  console.log('\nTotal Status counts:', statusCounts);
  process.exit(0);
});
