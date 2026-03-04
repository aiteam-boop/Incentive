const { MongoClient } = require('mongodb');

async function check() {
    const uri = 'mongodb+srv://aiteamcrystal_db_user:bX0q9ZNUad5gTUbP@salescrystal.0f9uk0t.mongodb.net/sales_crm?retryWrites=true&w=majority';
    const client = new MongoClient(uri);
    await client.connect();

    // Check both the 'operations' db and 'sales_crm'
    for (const dbName of ['sales_crm', 'operations']) {
        const db = client.db(dbName);
        const cols = await db.listCollections().toArray();
        const colNames = cols.map(c => c.name);
        console.log(`\nDB: ${dbName} — Collections: ${colNames.join(', ')}`);

        if (colNames.includes('stage1_data')) {
            const doc = await db.collection('stage1_data').findOne({});
            if (doc) {
                console.log('stage1_data keys:', Object.keys(doc).filter(k => !k.startsWith('_')).join(', '));
                const eq = Object.keys(doc).filter(k => k.toLowerCase().includes('enquiry') || k.toLowerCase().includes('sales'));
                console.log('  Enquiry-related fields:', eq);
            }
        }

        if (colNames.includes('stage6_data')) {
            const doc = await db.collection('stage6_data').findOne({});
            if (doc) {
                console.log('stage6_data keys:', Object.keys(doc).filter(k => !k.startsWith('_')).join(', '));
                const eq = Object.keys(doc).filter(k => k.toLowerCase().includes('enquiry') || k.toLowerCase().includes('pi') || k.toLowerCase().includes('sales'));
                console.log('  Enquiry/PI-related fields:', eq);
            }
        }
    }

    client.close();
}

check().catch(console.error);
