const express = require('express');
const Lead = require('../models/Lead');
const { authenticate, authorize } = require('../middleware/auth');
const {
  calculateProspectorIncentive,
  calculateClosureIncentive,
  updateMonthlyPerformance,
  reverseIncentive,
  getCurrentMonth,
} = require('../utils/incentiveEngine');
const IncentiveLedger = require('../models/IncentiveLedger');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Helper: get the user's incentive role
const getRole = (req) => req.user.incentive_role;

// GET /api/leads - List leads with role-based filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const { stage, page = 1, limit = 50 } = req.query;
    const filter = {};
    const role = getRole(req);

    // Role-based filtering — no cross-team data leak
    if (role === 'prospector') {
      filter.createdByProspector = req.user._id;
    } else if (role === 'sql_closure') {
      filter.assignedSqlCloser = req.user._id;
      filter.sqlVerified = true; // SQL Closure can only see verified SQL leads
    }
    // admin sees all

    if (stage) filter.stage = stage;

    const leads = await Lead.find(filter)
      .populate('createdByProspector', 'agentName username')
      .populate('assignedSqlCloser', 'agentName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Lead.countDocuments(filter);

    res.json({ success: true, leads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/leads/:id - Get single lead with role check
router.get('/:id', authenticate, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('createdByProspector', 'agentName username')
      .populate('assignedSqlCloser', 'agentName username')
      .populate('sqlVerifiedByAdmin', 'agentName username')
      .populate('sqlVerifiedByCEO', 'agentName username')
      .populate('closureVerifiedByAdmin', 'agentName username')
      .populate('closureVerifiedByCEO', 'agentName username');

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const role = getRole(req);

    // Security: prospectors can only see their own leads
    if (role === 'prospector' && lead.createdByProspector?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Security: sql_closure can only see leads assigned to them
    if (role === 'sql_closure' && lead.assignedSqlCloser?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get associated incentives (filtered by role)
    let incentiveFilter = { leadId: lead._id };
    if (role === 'prospector') {
      incentiveFilter.incentiveType = 'SQL'; // Prospectors only see SQL incentives
      incentiveFilter.userId = req.user._id;
    } else if (role === 'sql_closure') {
      incentiveFilter.incentiveType = { $in: ['Closure', 'Bonus_SQL_Milestone', 'Bonus_PO_Milestone'] };
      incentiveFilter.userId = req.user._id;
    }

    const incentives = await IncentiveLedger.find(incentiveFilter);

    res.json({ success: true, lead, incentives });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/leads - Create a new lead (prospector or admin)
router.post('/', authenticate, authorize('prospector', 'admin'), async (req, res) => {
  try {
    const { leadName, company, contactEmail, contactPhone, source, dealValue, notes } = req.body;

    if (!leadName) {
      return res.status(400).json({ success: false, message: 'Lead name is required' });
    }

    const lead = await Lead.create({
      leadName,
      company,
      contactEmail,
      contactPhone,
      source,
      dealValue: dealValue || 0,
      notes,
      createdByProspector: req.user._id,
      stage: 'Prospect',
    });

    await AuditLog.create({
      userId: req.user._id,
      action: 'LEAD_CREATED',
      entity: 'Lead',
      entityId: lead._id,
      details: { leadName, company },
    });

    res.status(201).json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/mark-sql - Prospector marks lead as SQL
router.put('/:id/mark-sql', authenticate, authorize('prospector', 'admin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.stage !== 'Prospect') {
      return res.status(400).json({ success: false, message: 'Lead is not in Prospect stage' });
    }

    lead.stage = 'SQL';
    lead.sqlMarkedDate = new Date();
    await lead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'LEAD_MARKED_SQL',
      entity: 'Lead',
      entityId: lead._id,
      details: { previousStage: 'Prospect' },
    });

    res.json({ success: true, lead, message: 'Lead marked as SQL. Awaiting verification.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/verify-sql - Admin verifies SQL (as Admin or CEO)
router.put('/:id/verify-sql', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { verifierRole } = req.body; // 'Admin' or 'CEO'
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.stage !== 'SQL') {
      return res.status(400).json({ success: false, message: 'Lead is not in SQL stage' });
    }

    if (verifierRole === 'CEO') {
      lead.sqlVerifiedByCEO = req.user._id;
    } else {
      lead.sqlVerifiedByAdmin = req.user._id;
    }

    // Both verified → SQL fully verified
    if (lead.sqlVerifiedByAdmin && lead.sqlVerifiedByCEO) {
      lead.sqlVerified = true;
      lead.sqlVerifiedDate = new Date();

      // Trigger Prospector incentive
      const result = await calculateProspectorIncentive(lead, req.user._id);
      if (result.success) {
        await AuditLog.create({
          userId: req.user._id,
          action: 'SQL_VERIFIED_COMPLETE',
          entity: 'Lead',
          entityId: lead._id,
          details: { incentiveCreated: true },
        });
      }
    }

    await lead.save();

    res.json({
      success: true,
      lead,
      sqlVerified: lead.sqlVerified,
      message: lead.sqlVerified
        ? 'SQL fully verified. Prospector incentive created.'
        : `SQL verified by ${verifierRole || 'Admin'}. Awaiting ${!lead.sqlVerifiedByAdmin ? 'Admin' : 'CEO'} verification.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/assign-closer - Admin assigns SQL Closure team member
router.put('/:id/assign-closer', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { closerId } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (!lead.sqlVerified) {
      return res.status(400).json({ success: false, message: 'SQL must be verified first' });
    }

    lead.assignedSqlCloser = closerId;
    await lead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'CLOSER_ASSIGNED',
      entity: 'Lead',
      entityId: lead._id,
      details: { closerId },
    });

    res.json({ success: true, lead, message: 'SQL Closer assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/mark-closed - SQL Closure marks deal as closed
router.put('/:id/mark-closed', authenticate, authorize('sql_closure', 'admin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (!lead.sqlVerified) {
      return res.status(400).json({ success: false, message: 'SQL must be verified first' });
    }

    if (lead.stage !== 'SQL') {
      return res.status(400).json({ success: false, message: 'Lead must be in SQL stage' });
    }

    lead.stage = 'Closed';
    lead.closureDate = new Date();
    await lead.save();

    // Update monthly performance for SQL closer
    if (lead.assignedSqlCloser) {
      await updateMonthlyPerformance(lead.assignedSqlCloser, getCurrentMonth(), 'sql_closed');
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'LEAD_MARKED_CLOSED',
      entity: 'Lead',
      entityId: lead._id,
      details: {},
    });

    res.json({ success: true, lead, message: 'Deal marked as closed. Awaiting verification.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/verify-closure - Admin verifies closure (as Admin or CEO)
router.put('/:id/verify-closure', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { verifierRole } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.stage !== 'Closed') {
      return res.status(400).json({ success: false, message: 'Lead is not in Closed stage' });
    }

    if (verifierRole === 'CEO') {
      lead.closureVerifiedByCEO = req.user._id;
    } else {
      lead.closureVerifiedByAdmin = req.user._id;
    }

    // Both verified → closure fully verified
    if (lead.closureVerifiedByAdmin && lead.closureVerifiedByCEO) {
      lead.closureVerified = true;
      lead.closureVerifiedDate = new Date();

      // Approve Prospector incentive if still pending
      await IncentiveLedger.updateMany(
        { leadId: lead._id, incentiveType: 'SQL', status: 'Pending' },
        { status: 'Approved', approvedBy: req.user._id, approvedAt: new Date() }
      );
    }

    await lead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'CLOSURE_VERIFIED',
      entity: 'Lead',
      entityId: lead._id,
      details: { verifierRole, fullyVerified: lead.closureVerified },
    });

    res.json({
      success: true,
      lead,
      closureVerified: lead.closureVerified,
      message: lead.closureVerified
        ? 'Closure fully verified. Prospector incentive approved.'
        : `Closure verified by ${verifierRole || 'Admin'}. Awaiting ${!lead.closureVerifiedByAdmin ? 'Admin' : 'CEO'} verification.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/generate-po - Generate PO
router.put('/:id/generate-po', authenticate, authorize('admin', 'sql_closure'), async (req, res) => {
  try {
    const { poNumber } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (!lead.closureVerified) {
      return res.status(400).json({ success: false, message: 'Closure must be verified first' });
    }

    if (lead.stage !== 'Closed') {
      return res.status(400).json({ success: false, message: 'Lead must be in Closed stage' });
    }

    lead.stage = 'PO_Generated';
    lead.poGenerated = true;
    lead.poGeneratedDate = new Date();
    lead.poNumber = poNumber || `PO-${Date.now()}`;
    await lead.save();

    // Trigger SQL Closure team incentive
    const result = await calculateClosureIncentive(lead, req.user._id);

    await AuditLog.create({
      userId: req.user._id,
      action: 'PO_GENERATED',
      entity: 'Lead',
      entityId: lead._id,
      details: { poNumber: lead.poNumber, incentiveCreated: result.success },
    });

    res.json({
      success: true,
      lead,
      incentiveResult: result,
      message: 'PO generated. SQL Closure team incentive created.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/reject - Reject a lead (admin only)
router.put('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const previousStage = lead.stage;
    lead.stage = 'Rejected';
    lead.rejectionReason = reason;
    await lead.save();

    // Reverse all incentives for this lead
    const incentives = await IncentiveLedger.find({
      leadId: lead._id,
      status: { $ne: 'Reversed' },
    });

    for (const inc of incentives) {
      await reverseIncentive(inc._id, `Lead rejected: ${reason}`, req.user._id);
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'LEAD_REJECTED',
      entity: 'Lead',
      entityId: lead._id,
      details: { previousStage, reason, incentivesReversed: incentives.length },
    });

    res.json({
      success: true,
      lead,
      message: `Lead rejected. ${incentives.length} incentive(s) reversed.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/leads/:id/cancel-po - Cancel PO (admin only)
router.put('/:id/cancel-po', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (!lead.poGenerated) {
      return res.status(400).json({ success: false, message: 'No PO to cancel' });
    }

    lead.poCancelled = true;
    lead.stage = 'Closed';
    lead.poGenerated = false;
    await lead.save();

    // Reverse closure incentive
    const closureIncentives = await IncentiveLedger.find({
      leadId: lead._id,
      incentiveType: 'Closure',
      status: { $ne: 'Reversed' },
    });

    for (const inc of closureIncentives) {
      await reverseIncentive(inc._id, `PO cancelled: ${reason}`, req.user._id);
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'PO_CANCELLED',
      entity: 'Lead',
      entityId: lead._id,
      details: { reason, incentivesReversed: closureIncentives.length },
    });

    res.json({
      success: true,
      lead,
      message: `PO cancelled. ${closureIncentives.length} closure incentive(s) reversed.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
