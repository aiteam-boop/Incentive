const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeamTarget = require('../models/TeamTarget');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/team-targets
 * Get all team targets and users grouped by team
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const teamTargets = await TeamTarget.find({});
        const users = await User.find({ 
            incentive_role: { $in: ['inbound', 'outbound', 'sql_closure'] } 
        }, 'username agentName incentive_role');

        const groupedUsers = {
            inbound: users.filter(u => u.incentive_role === 'inbound'),
            outbound: users.filter(u => u.incentive_role === 'outbound'),
            sql_closure: users.filter(u => u.incentive_role === 'sql_closure'),
        };

        res.json({
            success: true,
            teamTargets,
            groupedUsers
        });
    } catch (error) {
        console.error('GET /api/team-targets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/team-targets/:team
 * Update targets for a specific team AND sync to each agent's individual targets document.
 */
router.put('/:team', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { team } = req.params;
        const { po_target, sql_target, price_target } = req.body;

        const updatedBy = req.user.agentName || req.user.username || 'Admin';

        const newEntry = {
            po_target: Number(po_target),
            sql_target: Number(sql_target),
            price_target: Number(price_target),
            updatedAt: new Date(),
            updatedBy,
        };

        // 1. Update team_targets collection (TeamTarget model)
        const updated = await TeamTarget.findOneAndUpdate(
            { team },
            { 
                po_target: Number(po_target), 
                sql_target: Number(sql_target), 
                price_target: Number(price_target),
                updatedBy: newEntry.updatedBy,
                $push: { history: newEntry }
            },
            { new: true, upsert: true }
        );

        // 2. Find all users in this team and sync their individual targets documents
        const teamUsers = await User.find({ incentive_role: team }, 'agentName username');
        const targetsCollection = mongoose.connection.db.collection('targets');

        const historyEntry = {
            'Monthly Po Target': Number(po_target),
            'Monthly Sql Target': Number(sql_target),
            'Monthly Price': Number(price_target),
            updatedAt: new Date().toISOString(),
            updatedBy,
            source: 'team_edit',
        };

        const syncResults = [];
        for (const user of teamUsers) {
            const agentName = user.agentName || user.username;
            const existing = await targetsCollection.findOne({ Lead_Owner: agentName });

            if (existing) {
                // Update individual targets document — both root fields AND history
                await targetsCollection.updateOne(
                    { Lead_Owner: agentName },
                    {
                        $set: {
                            'Monthly Po Target': Number(po_target),
                            'Monthly Sql Target': Number(sql_target),
                            'Monthly Price': Number(price_target),
                        },
                        $push: { target_update_history: historyEntry },
                    }
                );
                syncResults.push({ agentName, status: 'updated' });
            } else {
                // Create a minimal targets document for this agent
                await targetsCollection.insertOne({
                    Lead_Owner: agentName,
                    'Monthly Po Target': Number(po_target),
                    'Monthly Sql Target': Number(sql_target),
                    'Monthly Price': Number(price_target),
                    target_update_history: [historyEntry],
                    _createdByTeamEdit: true,
                    _createdAt: new Date().toISOString(),
                });
                syncResults.push({ agentName, status: 'created' });
            }
        }

        console.log(`✅ Team targets updated for [${team}]. Synced ${syncResults.length} agents:`, syncResults);

        res.json({
            success: true,
            message: `Targets updated for ${team} team. ${syncResults.length} agent(s) synced.`,
            teamTarget: updated,
            syncResults,
        });
    } catch (error) {
        console.error('PUT /api/team-targets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

