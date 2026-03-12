
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

async function check2026() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales_crm';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('leads_master');
    
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 2, 31, 23, 59, 59);
    
    console.log('Searching for ALL leads in 2026 Q1...');
    const leads = await col.find({
      PO_Date: { $gte: start, $lte: end }
    }).limit(10).toArray();
    
    console.log('Found:', leads.length);
    if (leads.length > 0) {
        leads.forEach(l => console.log(`${l['Enquiry Code']} - ${l.Lead_Owner} - ${l.PO_Date}`));
    } else {
        console.log('No leads found in 2026 Q1 with Date comparison.');
        console.log('Checking for string dates...');
        const leadsStr = await col.find({
            PO_Date: { $regex: /2026/ }
        }).limit(5).toArray();
        console.log('Found with string regex:', leadsStr.length);
        if (leadsStr.length > 0) {
            console.log('Sample string date:', leadsStr[0].PO_Date);
            console.log('Type:', typeof leadsStr[0].PO_Date);
        }
    }
  } finally {
    await client.close();
  }
}

check2026();
