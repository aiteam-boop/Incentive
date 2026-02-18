const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const Settings = require('../models/Settings');
const { DEFAULTS } = require('./incentiveEngine');

/**
 * Role Assignment Map — maps existing usernames to incentive_role.
 * 
 * IMPORTANT: No demo users are created. Only existing DB users get roles.
 * Names can change → roles stay. Update this map if team changes.
 */
const ROLE_ASSIGNMENTS = {
  // Admins — full incentive dashboard, verify SQL/Closure/PO, config access
  pushpalata: 'admin',
  amisha: 'admin',

  // SQL Closure Team — see assigned leads, closure/PO incentives, bonus tracking
  anjali: 'sql_closure',   // Note: No "Angela" found in DB. Closest is "Anjali". Update if needed.

  // Prospectors — see only their SQL incentives, SQL verification status
  aparna: 'prospector',
  sapna: 'prospector',
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB (sales_crm database)\n');

    // ──────────────────────────────────────────────
    // Step 1: Assign incentive_role to existing users
    // ──────────────────────────────────────────────
    console.log('📋 Assigning incentive roles to existing users...\n');

    const allUsers = await User.find({});
    console.log(`   Found ${allUsers.length} users in 'users' collection\n`);

    for (const user of allUsers) {
      const assignedRole = ROLE_ASSIGNMENTS[user.username] || null;
      if (user.incentive_role !== assignedRole) {
        user.incentive_role = assignedRole;
        await user.save();
        console.log(`   ✅ ${user.agentName || user.username} → incentive_role: ${assignedRole || '(none)'}`);
      } else {
        console.log(`   ⏭  ${user.agentName || user.username} → already: ${user.incentive_role || '(none)'}`);
      }
    }

    // ──────────────────────────────────────────────
    // Step 2: Seed default incentive settings
    // ──────────────────────────────────────────────
    console.log('\n📋 Seeding incentive settings...\n');

    for (const [key, value] of Object.entries(DEFAULTS)) {
      const existing = await Settings.findOne({ key });
      if (!existing) {
        await Settings.create({
          key,
          value,
          description: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        });
        console.log(`   ✅ Setting created: ${key} = ${value}`);
      } else {
        console.log(`   ⏭  Setting exists: ${key} = ${existing.value}`);
      }
    }

    // ──────────────────────────────────────────────
    // Step 3: Clean up old incentive_users collection (if exists)
    // ──────────────────────────────────────────────
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'incentive_users' }).toArray();
    if (collections.length > 0) {
      await db.dropCollection('incentive_users');
      console.log('\n   🗑  Dropped old incentive_users collection (no longer needed)');
    }

    // ──────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────
    console.log('\n🎉 Setup completed successfully!\n');
    console.log('📋 Role Assignments:');
    console.log('   ┌─────────────────────┬────────────────┐');
    console.log('   │ User                │ Incentive Role │');
    console.log('   ├─────────────────────┼────────────────┤');
    const assignedUsers = await User.find({ incentive_role: { $ne: null } }).sort({ incentive_role: 1 });
    assignedUsers.forEach((u) => {
      const name = (u.agentName || u.username).padEnd(19);
      const role = u.incentive_role.padEnd(14);
      console.log(`   │ ${name} │ ${role} │`);
    });
    console.log('   └─────────────────────┴────────────────┘');

    console.log('\n🔐 Login: Use existing Sales Dashboard credentials (username + password)');
    console.log('   Users without an incentive_role will not have access.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

seed();
