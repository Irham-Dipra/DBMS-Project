const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { body, validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
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
    res.status(400).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

router.get('/', usersController.getAllUsers);

// GET /users/:userId - Get a specific user's public profile
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, bio, profile_picture_url, created_at, is_moderator
       FROM users 
       WHERE id = $1 AND is_active = true`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:userId/books - Get a user's public books
router.get('/:userId/books', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT 
        b.id, b.title, b.cover_image, b.average_rating,
        ub.shelf, ub.rating as user_rating,
        a.id as author_id, a.name as author_name
       FROM user_books ub
       JOIN books b ON ub.book_id = b.id  
       JOIN book_authors ba ON b.id = ba.book_id
       JOIN authors a ON ba.author_id = a.id
       WHERE ub.user_id = $1
       ORDER BY ub.updated_at DESC
       LIMIT 20`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user books:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:userId/reviews - Get a user's public reviews
router.get('/:userId/reviews', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT 
        r.id, r.title, r.body, r.rating, r.created_at,
        b.title as book_title, b.cover_image,
        a.name as author_name
       FROM reviews r
       JOIN books b ON r.book_id = b.id
       JOIN book_authors ba ON b.id = ba.book_id  
       JOIN authors a ON ba.author_id = a.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:userId/stats - Get a user's reading stats
router.get('/:userId/stats', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_books,
        COUNT(CASE WHEN shelf = 'read' THEN 1 END) as books_read,
        COUNT(CASE WHEN shelf = 'currently-reading' THEN 1 END) as currently_reading,
        COUNT(CASE WHEN shelf = 'want-to-read' THEN 1 END) as want_to_read,
        COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_books,
        ROUND(AVG(rating), 1) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE user_id = $1) as total_reviews
       FROM user_books 
       WHERE user_id = $1`,
      [userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /users/profile - Update user profile
router.put('/profile', [
  body('first_name').optional().isString().trim().isLength({ max: 50 }).withMessage('First name must be a string with max 50 characters'),
  body('last_name').optional().isString().trim().isLength({ max: 50 }).withMessage('Last name must be a string with max 50 characters'),
  body('bio').optional().isString().trim().isLength({ max: 500 }).withMessage('Bio must be a string with max 500 characters'),
  body('profile_picture_url').optional().isURL().withMessage('Profile picture must be a valid URL')
], verifyToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { first_name, last_name, bio, profile_picture_url } = req.body;

    // Build update query dynamically based on provided fields
    let updateQuery = 'UPDATE users SET ';
    const updateParams = [];
    const updates = [];
    let paramCount = 0;

    if (first_name !== undefined) {
      paramCount++;
      updates.push(`first_name = $${paramCount}`);
      updateParams.push(first_name);
    }

    if (last_name !== undefined) {
      paramCount++;
      updates.push(`last_name = $${paramCount}`);
      updateParams.push(last_name);
    }

    if (bio !== undefined) {
      paramCount++;
      updates.push(`bio = $${paramCount}`);
      updateParams.push(bio);
    }

    if (profile_picture_url !== undefined) {
      paramCount++;
      updates.push(`profile_picture_url = $${paramCount}`);
      updateParams.push(profile_picture_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    updateQuery += updates.join(', ');
    updateQuery += ` WHERE id = $${paramCount + 1} RETURNING id, username, email, first_name, last_name, bio, profile_picture_url, created_at`;
    updateParams.push(userId);

    const result = await pool.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

module.exports = router;
