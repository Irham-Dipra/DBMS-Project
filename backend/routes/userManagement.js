// routes/userManagement.js
const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT token and check if user is moderator
const verifyModeratorToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    
    // Check if user exists and is a moderator (using moderator_accounts table)
    const userResult = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.role,
        EXISTS(SELECT 1 FROM moderator_accounts m WHERE m.user_id = u.id) AS is_moderator
      FROM users u 
      WHERE u.id = $1
    `, [decoded.id]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    const user = userResult.rows[0];
    console.log('User attempting moderator action:', user); // Debug log
    
    // Check if user is moderator via moderator_accounts table OR role column
    if (!user.is_moderator && user.role !== 'moderator' && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Moderator privileges required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Deactivate a user
router.post('/deactivate-user', verifyModeratorToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId, reason, durationDays } = req.body;
    const moderatorId = req.user.id;
    
    console.log('Deactivation request data:', { userId, reason, durationDays, moderatorId }); // Debug log

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Deactivation reason is required' 
      });
    }

    // Validate duration if provided
    if (durationDays && (durationDays < 1 || durationDays > 365)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Duration must be between 1 and 365 days' 
      });
    }

    await client.query('BEGIN');

    // Check if user exists and is currently active
    const userCheck = await client.query(
      'SELECT id, username, is_active, role FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const targetUser = userCheck.rows[0];

    // Prevent deactivating other moderators/admins
    if (targetUser.role === 'moderator' || targetUser.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot deactivate moderator or admin users' 
      });
    }

    // Prevent deactivating self
    if (targetUser.id === moderatorId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot deactivate your own account' 
      });
    }

    if (!targetUser.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'User is already deactivated' 
      });
    }

    // Calculate auto reactivation date if duration is provided
    let autoReactivateAt = null;
    if (durationDays) {
      autoReactivateAt = new Date();
      autoReactivateAt.setDate(autoReactivateAt.getDate() + durationDays);
    }

    // Deactivate the user
    await client.query(`
      UPDATE users 
      SET is_active = FALSE,
          deactivation_reason = $1,
          deactivated_by = $2,
          deactivated_at = CURRENT_TIMESTAMP,
          deactivation_duration_days = $3,
          auto_reactivate_at = $4
      WHERE id = $5
    `, [reason, moderatorId, durationDays, autoReactivateAt, userId]);

    // Log the deactivation in history
    await client.query(`
      INSERT INTO user_deactivation_history (
        user_id, 
        moderator_id, 
        action, 
        reason, 
        duration_days, 
        auto_reactivate_at
      ) VALUES ($1, $2, 'deactivate', $3, $4, $5)
    `, [userId, moderatorId, reason, durationDays, autoReactivateAt]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `User ${targetUser.username} has been deactivated successfully`,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        deactivatedBy: req.user.username,
        reason: reason,
        durationDays: durationDays,
        autoReactivateAt: autoReactivateAt
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deactivating user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while deactivating user' 
    });
  } finally {
    client.release();
  }
});

// Reactivate a user
router.post('/reactivate-user', verifyModeratorToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId, reason = 'Manual reactivation by moderator' } = req.body;
    const moderatorId = req.user.id;

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    await client.query('BEGIN');

    // Check if user exists and is currently deactivated
    const userCheck = await client.query(
      'SELECT id, username, is_active FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const targetUser = userCheck.rows[0];

    if (targetUser.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'User is already active' 
      });
    }

    // Reactivate the user
    await client.query(`
      UPDATE users 
      SET is_active = TRUE,
          deactivation_reason = NULL,
          deactivated_by = NULL,
          deactivated_at = NULL,
          deactivation_duration_days = NULL,
          auto_reactivate_at = NULL
      WHERE id = $1
    `, [userId]);

    // Log the reactivation in history
    await client.query(`
      INSERT INTO user_deactivation_history (
        user_id, 
        moderator_id, 
        action, 
        reason
      ) VALUES ($1, $2, 'reactivate', $3)
    `, [userId, moderatorId, reason]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `User ${targetUser.username} has been reactivated successfully`,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        reactivatedBy: req.user.username,
        reason: reason
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reactivating user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while reactivating user' 
    });
  } finally {
    client.release();
  }
});

// Get user activation status and history
router.get('/user-status/:userId', verifyModeratorToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user activation status
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.deactivation_reason,
        u.deactivated_at,
        u.deactivation_duration_days,
        u.auto_reactivate_at,
        moderator.username as deactivated_by_username,
        CASE 
          WHEN u.is_active = FALSE AND u.auto_reactivate_at IS NOT NULL THEN
            CASE 
              WHEN u.auto_reactivate_at > CURRENT_TIMESTAMP THEN
                EXTRACT(DAYS FROM (u.auto_reactivate_at - CURRENT_TIMESTAMP))::INTEGER
              ELSE 0
            END
          ELSE NULL
        END as days_until_reactivation,
        u.created_at
      FROM users u
      LEFT JOIN users moderator ON u.deactivated_by = moderator.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get user deactivation history
    const historyResult = await pool.query(`
      SELECT 
        h.id,
        h.action,
        h.reason,
        h.duration_days,
        h.auto_reactivate_at,
        h.created_at,
        m.username as moderator_username
      FROM user_deactivation_history h
      JOIN users m ON h.moderator_id = m.id
      WHERE h.user_id = $1
      ORDER BY h.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        history: historyResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while fetching user status' 
    });
  }
});

// Auto-reactivate users (to be called periodically)
router.post('/auto-reactivate', verifyModeratorToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT auto_reactivate_users()');
    const reactivatedCount = result.rows[0].auto_reactivate_users;

    res.json({
      success: true,
      message: `Auto-reactivated ${reactivatedCount} users`,
      data: {
        reactivatedCount: reactivatedCount
      }
    });

  } catch (error) {
    console.error('Error in auto-reactivation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during auto-reactivation' 
    });
  }
});

module.exports = router;