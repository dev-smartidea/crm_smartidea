const mongoose = require('mongoose');
const Service = require('./models/Service');

mongoose.connect('mongodb://localhost:27017/crm_smartidea').then(async () => {
  console.log('Connected to MongoDB');
  
  const all = await Service.find().select('name status');
  console.log('\nAll services:');
  all.forEach(s => console.log(`- ${s.name}: ${s.status}`));
  
  const statusCounts = {};
  all.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });
  
  console.log('\nStatus counts:', statusCounts);
  process.exit(0);
});
