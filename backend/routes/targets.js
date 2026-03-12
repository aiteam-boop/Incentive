const express = require('express');
const mongoose = require('mongoose');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: get the raw targets collection (not the Target Mongoose model)
function getTargetsCollection() {
    return mongoose.connection.db.collection('targets');
}

/**
 * Helper: resolve effective target values for a document.
 * If target_update_history exists and has entries, use the LAST element.
 * Otherwise fall back to root-level imported fields.
 */
function resolveEffectiveTarget(doc) {
    const hasHistory =
        Array.isArray(doc.target_update_history) && doc.target_update_history.length > 0;

    const latest = hasHistory
        ? doc.target_update_history[doc.target_update_history.length - 1]
        : null;

    return {
        Lead_Owner: doc.Lead_Owner,
        // Effective values (latest override or original)
        'Monthly Sql Target': latest?.['Monthly Sql Target'] ?? doc['Monthly Sql Target'] ?? 0,
        'Monthly Po Target': latest?.['Monthly Po Target'] ?? doc['Monthly Po Target'] ?? 0,
        'Monthly Price': latest?.['Monthly Price'] ?? doc['Monthly Price'] ?? 0,
        'Monthly Mql Target': latest?.['Monthly Mql Target'] ?? doc['Monthly Mql Target'] ?? 0,
        'Monthly Call_Target': latest?.['Monthly Call_Target'] ?? doc['Monthly Call_Target'] ?? 0,
        'Quaterly Sql Target': latest?.['Quaterly Sql Target'] ?? doc['Quaterly Sql Target'] ?? 0,
        'Quaterly Po Target': latest?.['Quaterly Po Target'] ?? doc['Quaterly Po Target'] ?? 0,
        'Quaterly Closure Target': latest?.['Quaterly Closure Target'] ?? doc['Quaterly Closure Target'] ?? 0,
        // Original imported root-level values (never touched)
        original: {
            'Monthly Sql Target': doc['Monthly Sql Target'] ?? 0,
            'Monthly Po Target': doc['Monthly Po Target'] ?? 0,
            'Monthly Price': doc['Monthly Price'] ?? 0,
            'Monthly Mql Target': doc['Monthly Mql Target'] ?? 0,
            'Monthly Call_Target': doc['Monthly Call_Target'] ?? 0,
            'Quaterly Sql Target': doc['Quaterly Sql Target'] ?? 0,
            'Quaterly Po Target': doc['Quaterly Po Target'] ?? 0,
            'Quaterly Closure Target': doc['Quaterly Closure Target'] ?? 0,
        },
        // History metadata
        hasHistory,
        historyCount: doc.target_update_history?.length || 0,
        latestUpdate: latest
            ? { updatedAt: latest.updatedAt, updatedBy: latest.updatedBy }
            : null,
        // Full history for detail view (sent for admin)
        target_update_history: doc.target_update_history || [],
    };
}

/**
 * GET /api/targets
 * List all target documents with effective values applied.
 * Admin only.
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const col = getTargetsCollection();

        // Fetch all target docs; project out large/unused fields if needed
        const docs = await col.find({}).toArray();

        const targets = docs.map(resolveEffectiveTarget);

        res.json({ success: true, targets });
    } catch (error) {
        console.error('GET /targets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/targets/:leadOwner
 * Get single target document for a Lead_Owner.
 * Admin only.
 */
router.get('/:leadOwner', authenticate, authorize('admin'), async (req, res) => {
    try {
        const col = getTargetsCollection();
        const doc = await col.findOne({ Lead_Owner: req.params.leadOwner });

        if (!doc) {
            return res.status(404).json({ success: false, message: `Target not found for: ${req.params.leadOwner}` });
        }

        res.json({ success: true, target: resolveEffectiveTarget(doc) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/targets/update
 * Admin updates a target.
 * Syncs root fields AND appends a history snapshot.
 */
router.put('/update', authenticate, authorize('admin'), async (req, res) => {
    try {
        const col = getTargetsCollection();
        const { Lead_Owner, ...fields } = req.body;

        if (!Lead_Owner) {
            return res.status(400).json({ success: false, message: 'Lead_Owner is required' });
        }

        const existingDoc = await col.findOne({ Lead_Owner });
        if (!existingDoc) {
            return res.status(404).json({ success: false, message: `Target doc not found for: ${Lead_Owner}` });
        }

        // 1. Build new history entry
        const historyEntry = {
            ...fields,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.agentName || req.user.username || 'Admin'
        };

        // 2. Perform Update: 
        // - Set root-level fields (to reflect immediately in dashboard/UI)
        // - Push to target_update_history
        const updatePayload = {
            $set: fields,
            $push: { target_update_history: historyEntry }
        };

        await col.updateOne({ Lead_Owner }, updatePayload);

        const updatedDoc = await col.findOne({ Lead_Owner });
        res.json({
            success: true,
            message: `Targets updated for ${Lead_Owner}`,
            target: resolveEffectiveTarget(updatedDoc)
        });
    } catch (error) {
        console.error('PUT /targets/update error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/targets/:leadOwner
 * Same as above but via URL param.
 */
router.put('/:leadOwner', authenticate, authorize('admin'), async (req, res) => {
    try {
        const col = getTargetsCollection();
        const leadOwner = req.params.leadOwner;

        const existingDoc = await col.findOne({ Lead_Owner: leadOwner });
        if (!existingDoc) {
            return res.status(404).json({ success: false, message: `Target not found for: ${leadOwner}` });
        }

        const historyEntry = {
            ...req.body,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.agentName || req.user.username || 'Admin'
        };

        await col.updateOne(
            { Lead_Owner: leadOwner },
            {
                $set: req.body,
                $push: { target_update_history: historyEntry }
            }
        );

        const updatedDoc = await col.findOne({ Lead_Owner: leadOwner });
        res.json({
            success: true,
            message: `Target updated for ${leadOwner}`,
            target: resolveEffectiveTarget(updatedDoc)
        });
    } catch (error) {
        console.error('PUT /targets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * DELETE /api/targets/:leadOwner/reset
 * Admin resets target_update_history for a Lead_Owner.
 * This clears all history entries — original imported fields become active again.
 * ⚠️ This does NOT modify original fields, only clears the history array.
 */
router.delete('/:leadOwner/reset', authenticate, authorize('admin'), async (req, res) => {
    try {
        const col = getTargetsCollection();
        const leadOwner = req.params.leadOwner;

        const existingDoc = await col.findOne({ Lead_Owner: leadOwner });
        if (!existingDoc) {
            return res.status(404).json({ success: false, message: `Target not found for: ${leadOwner}` });
        }

        const historyCount = existingDoc.target_update_history?.length || 0;

        // Clear the history array using $set on ONLY the history array field
        await col.updateOne(
            { Lead_Owner: leadOwner },
            { $set: { target_update_history: [] } }
        );

        const updatedDoc = await col.findOne({ Lead_Owner: leadOwner });
        const resolved = resolveEffectiveTarget(updatedDoc);

        res.json({
            success: true,
            message: `Reset successful for ${leadOwner}. ${historyCount} history entries cleared. Original imported values are now active.`,
            target: resolved,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
