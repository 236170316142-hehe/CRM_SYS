const mongoose = require('mongoose');
require('dotenv').config();
const Lead = require('./models/Lead');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const leads = await Lead.find({}).populate('assignedTo', 'name email');
  console.log('Leads in DB:', leads.map(l => ({
    name: l.name,
    assignedTo: l.assignedTo ? l.assignedTo.name : 'Unassigned',
    source: l.source
  })));
  process.exit(0);
}
check();
