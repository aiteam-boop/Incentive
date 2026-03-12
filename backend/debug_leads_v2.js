
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

async function checkLeads() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales_crm';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
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
      console.log('PO Date field name test:', leads[0]['PO Date'] ? 'Found PO Date' : 'Not found PO Date');
    } else {
        console.log('Trying mixed owner name and status...');
        const leads2 = await col.find({
            Lead_Owner: { $regex: /pushpalata/i },
            Status: { $regex: /po/i }
        }).limit(1).toArray();
        if (leads2.length > 0) {
            console.log('Found ONE lead with regex:', JSON.stringify(leads2[0], null, 2));
        } else {
            console.log('Absolutely no leads found for Pushpalata with Status PO.');
        }
    }
  } finally {
    await client.close();
  }
}

checkLeads();
