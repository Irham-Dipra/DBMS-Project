// middleware/userActivationCheck.js
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to check if user is active before allowing access to restricted features
const checkUserActivation = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    
    // Check if user exists and is active
    const userResult = await pool.query(
      'SELECT id, username, is_active, deactivation_reason, auto_reactivate_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    const user = userResult.rows[0];
    
    console.log('User activation check for user:', { id: user.id, username: user.username, is_active: user.is_active, type: typeof user.is_active }); // Debug log

    // If user is deactivated, block access
    if (!user.is_active) {
      let message = 'Your account has been temporarily deactivated.';
      let additionalInfo = {};
      
      if (user.deactivation_reason) {
        additionalInfo.reason = user.deactivation_reason;
      }
      
      if (user.auto_reactivate_at) {
        const reactivateDate = new Date(user.auto_reactivate_at);
        const now = new Date();
        
        if (reactivateDate > now) {
          const daysUntilReactivation = Math.ceil((reactivateDate - now) / (1000 * 60 * 60 * 24));
          additionalInfo.reactivateIn = daysUntilReactivation;
          additionalInfo.reactivateDate = reactivateDate.toISOString();
          message += ` Your account will be automatically reactivated in ${daysUntilReactivation} days.`;
        } else {
          message += ' Your account should be reactivated shortly.';
        }
      } else {
        message += ' Please contact a moderator for assistance.';
      }
      
      return res.status(403).json({ 
        success: false, 
        message: message,
        code: 'USER_DEACTIVATED',
        ...additionalInfo
      });
    }

    // User is active, add user info to request and continue
    req.user = user;
    next();

  } catch (error) {
    console.error('User activation check error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during activation check' 
    });
  }
};

// Middleware that only adds user info if token is valid, but doesn't require authentication
const optionalUserActivationCheck = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    
    // Check if user exists and is active
    const userResult = await pool.query(
      'SELECT id, username, is_active, deactivation_reason, auto_reactivate_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      req.user = null;
      return next();
    }

    const user = userResult.rows[0];
    
    // Set user info regardless of activation status for optional checks
    req.user = user;
    next();

  } catch (error) {
    // If there's any error, just continue without user info
    req.user = null;
    next();
  }
};

// Function to get user activation status (for profile pages, etc.)
const getUserActivationStatus = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, username, is_active, deactivation_reason, deactivated_at, 
        deactivation_duration_days, auto_reactivate_at,
        CASE 
          WHEN is_active = FALSE AND auto_reactivate_at IS NOT NULL THEN
            CASE 
              WHEN auto_reactivate_at > CURRENT_TIMESTAMP THEN
                EXTRACT(DAYS FROM (auto_reactivate_at - CURRENT_TIMESTAMP))::INTEGER
              ELSE 0
            END
          ELSE NULL
        END as days_until_reactivation
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user activation status:', error);
    return null;
  }
};

module.exports = {
  checkUserActivation,
  optionalUserActivationCheck,
  getUserActivationStatus
};