const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Update Users
    console.log('Updating users...');
    const usersUpdate = [
      { username: "sapna", incentive_role: "inbound" },
      { username: "aparna", incentive_role: "outbound" },
      { username: "gauri", incentive_role: "sql_closure" }
    ];

    for (const u of usersUpdate) {
      const res = await db.collection('users').updateOne(
        { username: u.username },
        { $set: { incentive_role: u.incentive_role } }
      );
      console.log(`Updated ${u.username}: `, res.modifiedCount > 0 ? 'Success' : 'No change (maybe already set)');
    }

    // 2. Initialize Team Targets
    console.log('Initializing team targets...');
    const teams = [
      { team: "inbound", po_target: 10, sql_target: 40, price_target: 50000 },
      { team: "outbound", po_target: 8, sql_target: 35, price_target: 40000 },
      { team: "sql_closure", po_target: 5, sql_target: 20, price_target: 60000 }
    ];

    for (const t of teams) {
      const res = await db.collection('team_targets').updateOne(
        { team: t.team },
        { $setOnInsert: t },
        { upsert: true }
      );
      console.log(`Team ${t.team}: `, res.upsertedCount > 0 ? 'Inserted' : 'Already exists');
    }

    console.log('All updates complete');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
