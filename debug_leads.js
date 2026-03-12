
const mongoose = require('mongoose');
require('dotenv').config();

async function checkLeads() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/incentive_db');
  const db = mongoose.connection.db;
  const col = db.collection('leads_master');
  
  console.log('Searching for Pushpalata leads with Status: PO...');
  const leads = await col.find({
    Lead_Owner: "Pushpalata",
    Status: "PO"
  }).limit(5).toArray();
  
  console.log('Found:', leads.length);
  if (leads.length > 0) {
    console.log('First lead sample:', JSON.stringify(leads[0], null, 2));
    console.log('PO_Date type:', typeof leads[0].PO_Date);
  } else {
    console.log('No leads found with that exact filter. Trying case-insensitive...');
    const leads2 = await col.find({
      Lead_Owner: /pushpalata/i,
      Status: /po/i
    }).limit(5).toArray();
    console.log('Found with regex:', leads2.length);
    if (leads2.length > 0) {
        console.log('Lead Owner in DB:', leads2[0].Lead_Owner);
        console.log('Status in DB:', leads2[0].Status);
    }
  }
  
  process.exit(0);
}

checkLeads();
