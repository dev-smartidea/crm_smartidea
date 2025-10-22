const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/crm_smartidea').then(async () => {
  console.log('Connected to MongoDB');
  
  const users = await User.find().select('name email role');
  console.log('\nAll users:');
  users.forEach(u => {
    console.log(`- ${u.name} (${u.email}): role = ${u.role}, id = ${u._id}`);
  });
  
  process.exit(0);
});
