const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { withTransaction } = require('../utils/transactionHelper');

const router = express.Router();

// JWT Secret (you should put this in your .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Sign Up Route
router.post('/signup', [
  // Validation middleware
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    console.log(errors.array());
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    const { email, password, username, first_name, last_name, bio = '', profile_picture_url = '' } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const newUser = await pool.query(
      `INSERT INTO users (email, password, username, first_name, last_name, bio, profile_picture_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, email, username, first_name, last_name, created_at`,
      [email, hashedPassword, username, first_name, last_name, bio, profile_picture_url]
    );

    // Create JWT token
    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup'
    });
  }
});

// Sign In Route
router.post('/signin', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email and password'
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.rows[0].id, email: user.rows[0].email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user.rows[0];

    // Log login history and update active status using stored procedure
    const loginResult = await pool.query(
      'SELECT handle_user_login($1, $2) as success',
      [user.rows[0].id, req.ip || req.connection.remoteAddress || 'unknown']
    );
    
    if (!loginResult.rows[0].success) {
      throw new Error('Failed to log user login');
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signin'
    });
  }
});

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // If token is expired, update login history
    if (error.name === 'TokenExpiredError') {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          // Mark the session as logged out due to expiration using stored procedure
          try {
            const expiredLogoutResult = await pool.query(
              'SELECT handle_user_logout($1) as success',
              [decoded.id]
            );
            
            if (!expiredLogoutResult.rows[0].success) {
              console.error('Failed to log expired token logout for user:', decoded.id);
            }
          } catch (procedureError) {
            console.error('Stored procedure error during token expiration logout:', procedureError);
          }
        }
      } catch (dbError) {
        console.error('Error updating logout time on token expiration:', dbError);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Logout route
router.post('/logout', verifyToken, async (req, res) => {
  try {
    console.log('Logout endpoint called for user ID:', req.user.id);
    
    // Update logout time and active status using stored procedure
    const logoutResult = await pool.query(
      'SELECT handle_user_logout($1) as success',
      [req.user.id]
    );
    
    console.log('Logout procedure result:', logoutResult.rows[0].success);
    
    if (!logoutResult.rows[0].success) {
      throw new Error('Failed to log user logout');
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// Protected route example - Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await pool.query(`
      SELECT 
        u.id, u.email, u.username, u.first_name, u.last_name, u.bio, 
        u.profile_picture_url, u.created_at, u.is_active, u.deactivation_reason, 
        u.deactivated_at, u.deactivation_duration_days, u.auto_reactivate_at,
        EXISTS(SELECT 1 FROM moderator_accounts m WHERE m.user_id = u.id) AS is_moderator,
        CASE 
          WHEN u.is_active = FALSE AND u.auto_reactivate_at IS NOT NULL THEN
            CASE 
              WHEN u.auto_reactivate_at > CURRENT_TIMESTAMP THEN
                EXTRACT(DAYS FROM (u.auto_reactivate_at - CURRENT_TIMESTAMP))::INTEGER
              ELSE 0
            END
          ELSE NULL
        END as days_until_reactivation
      FROM users u 
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.rows[0]
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;