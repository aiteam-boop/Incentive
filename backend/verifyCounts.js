const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

async function verify() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('operations');

    for (const col of ['stage1_data', 'stage6_data', 'stage6_1_data']) {
        const count = await db.collection(col).countDocuments();
        console.log(`Collection ${col} count: ${count}`);
    }

    process.exit(0);
}
verify();
