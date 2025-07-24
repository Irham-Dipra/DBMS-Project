// backend/routes/userBooks.js - FIXED VERSION
const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { withTransaction } = require('../utils/transactionHelper');
const { StoredProcedures } = require('../utils/storedProcedureHelper');
const { checkUserActivation, optionalUserActivationCheck } = require('../middleware/userActivationCheck');

const router = express.Router();

// Middleware to verify JWT token
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

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

// Get user's books with filtering and sorting
router.get('/books', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      shelf = 'all', 
      sort = 'date_added', 
      order = 'desc', 
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build the query based on shelf filter - FIXED to use correct table/column names
    let query = `
      SELECT 
        b.id,
        b.title,
        (SELECT a.name FROM authors a 
         JOIN book_authors ba ON a.id = ba.author_id 
         WHERE ba.book_id = b.id 
         ORDER BY a.id ASC LIMIT 1) as author,
        b.cover_image as cover_url,
        COALESCE(b.average_rating, 0)::float as avg_rating,
        ub.shelf,
        ub.date_added,
        ub.date_read,
        ub.review_id,
        r.body as review,
        (SELECT g.name FROM genres g 
         JOIN book_genres bg ON g.id = bg.genre_id 
         WHERE bg.book_id = b.id 
         ORDER BY g.id ASC LIMIT 1) as genre,
        l.name as language,
        rt.value as user_rating
      FROM books b
      INNER JOIN user_books ub ON b.id = ub.book_id
      LEFT JOIN reviews r ON ub.review_id = r.id
      LEFT JOIN languages l ON b.language_id = l.id
      LEFT JOIN ratings rt ON b.id = rt.book_id AND rt.user_id = ub.user_id
      WHERE ub.user_id = $1
    `;
    
    const queryParams = [userId];
    let paramCount = 1;

    // Add shelf filter
    if (shelf !== 'all') {
      paramCount++;
      query += ` AND ub.shelf = $${paramCount}`;
      queryParams.push(shelf);
    }

    // Add sorting - FIXED to use correct column names
    const validSortFields = ['date_added', 'date_read', 'title', 'author', 'rating'];
    const sortField = validSortFields.includes(sort) ? sort : 'date_added';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    
    if (sortField === 'rating') {
      query += ` ORDER BY rt.value ${sortOrder}, b.average_rating ${sortOrder}`;
    } else if (sortField === 'title') {
      query += ` ORDER BY b.title ${sortOrder}`;
    } else if (sortField === 'author') {
      query += ` ORDER BY (SELECT a.name FROM authors a 
                    JOIN book_authors ba ON a.id = ba.author_id 
                    WHERE ba.book_id = b.id 
                    ORDER BY a.id ASC LIMIT 1) ${sortOrder}`;
    } else {
      query += ` ORDER BY ub.${sortField} ${sortOrder}`;
    }

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(offset);

    const books = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM user_books ub
      WHERE ub.user_id = $1
    `;
    
    const countParams = [userId];
    
    if (shelf !== 'all') {
      countQuery += ' AND ub.shelf = $2';
      countParams.push(shelf);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalBooks = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      books: books.rows,
      totalBooks,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalBooks / limit),
      hasNextPage: page * limit < totalBooks,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error('Error fetching user books:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching books' 
    });
  }
});

// Get user's shelves with book counts
router.get('/shelves', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const query = `
      SELECT 
        shelf as name,
        COUNT(*) as count
      FROM user_books 
      WHERE user_id = $1
      GROUP BY shelf
      ORDER BY 
        CASE shelf 
          WHEN 'want-to-read' THEN 1
          WHEN 'currently-reading' THEN 2
          WHEN 'read' THEN 3
          ELSE 4
        END
    `;

    const shelves = await pool.query(query, [userId]);

    res.json({ 
      success: true,
      shelves: shelves.rows 
    });

  } catch (error) {
    console.error('Error fetching user shelves:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching shelves' 
    });
  }
});

// Add a book to user's library
// Add book to user's shelf (requires active user)
router.post('/books', [
  body('bookId').isInt().withMessage('Book ID must be an integer'),
  body('shelf').optional().isIn(['want-to-read', 'currently-reading', 'read']).withMessage('Invalid shelf value')
], checkUserActivation, async (req, res) => {
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
    const { bookId, shelf } = req.body;

    // Add book to user's library using stored procedure
    const userBookId = await StoredProcedures.addBookToLibrary(userId, bookId, shelf || 'want-to-read');

    res.json({ 
      success: true,
      message: 'Book added to library successfully',
      userBookId: userBookId
    });

  } catch (error) {
    console.error('Error adding book to library:', error);
    
    if (error.message.includes('Book not found')) {
      return res.status(404).json({ 
        success: false,
        message: 'Book not found' 
      });
    }
    
    if (error.message.includes('Book already in library')) {
      return res.status(400).json({ 
        success: false,
        message: 'Book already in library' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while adding book to library' 
    });
  }
});

// Update book shelf or rating
// Update book shelf status (requires active user)
router.put('/books/:bookId', checkUserActivation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Manual validation since express-validator has issues with null values
    const { shelf, rating, dateRead, notes } = req.body;
    
    if (shelf !== undefined && shelf !== null && !['want-to-read', 'currently-reading', 'read'].includes(shelf)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid shelf value'
      });
    }
    
    if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const userId = req.user.id;
    const { bookId } = req.params;

    // Start transaction
    await client.query('BEGIN');

    // Check if book is in user's library
    const existingEntry = await client.query(
      'SELECT id, shelf FROM user_books WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );

    if (existingEntry.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false,
        message: 'Book not found in library' 
      });
    }

    // Special case: if unmarking as read (shelf is null), remove from library entirely
    if (shelf === null) {
      await client.query(
        'DELETE FROM user_books WHERE user_id = $1 AND book_id = $2',
        [userId, bookId]
      );

      // Commit transaction
      await client.query('COMMIT');

      return res.json({ 
        success: true,
        message: 'Book removed from library (unmarked as read)' 
      });
    }

    // Build update query for other cases
    let updateQuery = 'UPDATE user_books SET ';
    const updateParams = [];
    const updates = [];
    let paramCount = 0;

    if (shelf !== undefined) {
      paramCount++;
      updates.push(`shelf = $${paramCount}`);
      updateParams.push(shelf);
    }

    // Handle date_read logic
    let dateReadValue = dateRead;
    if (shelf === 'read' && dateRead === undefined) {
      // If marking as read and no specific date provided, use current date
      dateReadValue = new Date();
    }

    if (dateReadValue !== undefined) {
      paramCount++;
      updates.push(`date_read = $${paramCount}`);
      updateParams.push(dateReadValue);
    }

    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      updateParams.push(notes);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false,
        message: 'No updates provided' 
      });
    }

    updateQuery += updates.join(', ');
    updateQuery += ` WHERE user_id = $${paramCount + 1} AND book_id = $${paramCount + 2}`;
    updateParams.push(userId, bookId);

    console.log('Update query:', updateQuery);
    console.log('Update params:', updateParams);

    await client.query(updateQuery, updateParams);

    // If rating was updated, also save to ratings table
    if (rating !== undefined) {
      try {
        // Check if rating already exists in ratings table
        const existingRating = await client.query(
          'SELECT id FROM ratings WHERE user_id = $1 AND book_id = $2',
          [userId, bookId]
        );

        if (existingRating.rows.length > 0) {
          // Update existing rating
          await client.query(
            'UPDATE ratings SET value = $1, created_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND book_id = $3',
            [rating, userId, bookId]
          );
        } else {
          // Insert new rating
          await client.query(
            'INSERT INTO ratings (user_id, book_id, value, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [userId, bookId, rating]
          );
        }
      } catch (ratingError) {
        console.error('Error updating ratings table:', ratingError);
        await client.query('ROLLBACK');
        throw ratingError;
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    res.json({ 
      success: true,
      message: 'Book updated successfully' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating book:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating book',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Remove book from user's library
router.delete('/books/:bookId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.params;

    const deleteQuery = 'DELETE FROM user_books WHERE user_id = $1 AND book_id = $2';
    const result = await pool.query(deleteQuery, [userId, bookId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Book not found in library' 
      });
    }

    res.json({ 
      success: true,
      message: 'Book removed from library successfully' 
    });

  } catch (error) {
    console.error('Error removing book from library:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while removing book from library' 
    });
  }
});

// Get reading statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Use stored procedures to get comprehensive stats
    const stats = await StoredProcedures.getUserReadingStats(userId);
    const monthlyStats = await StoredProcedures.getMonthlyActivity(userId);
    const genreStats = await StoredProcedures.getGenreStats(userId);
    const authorStats = await StoredProcedures.getAuthorStats(userId);
    const bookLengthStats = await StoredProcedures.getBookLengthStats(userId);
    const ratingDistribution = await StoredProcedures.getRatingDistribution(userId);
    
    // Convert rating distribution to object format
    const ratingDistObj = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistObj[i] = 0;
    }
    ratingDistribution.forEach(row => {
      ratingDistObj[row.rating] = parseInt(row.count);
    });

    res.json({
      success: true,
      stats: stats,
      monthlyStats: monthlyStats,
      genreStats: genreStats,
      authorStats: authorStats,
      bookLengthStats: bookLengthStats,
      ratingDistribution: ratingDistObj
    });
  } catch (error) {
    console.error('Error fetching reading stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reading statistics' 
    });
  }
});

// Rate a book (separate endpoint for ratings table)
router.post('/books/:bookId/rate', checkUserActivation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { rating } = req.body;
    const userId = req.user.id;
    const { bookId } = req.params;

    // Validate rating
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Check if book exists
    const bookExists = await client.query(
      'SELECT id FROM books WHERE id = $1',
      [bookId]
    );

    if (bookExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check if rating already exists
    const existingRating = await client.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );

    if (existingRating.rows.length > 0) {
      // Update existing rating
      await client.query(
        'UPDATE ratings SET value = $1, created_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND book_id = $3',
        [rating, userId, bookId]
      );
    } else {
      // Insert new rating
      await client.query(
        'INSERT INTO ratings (user_id, book_id, value, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [userId, bookId, rating]
      );
    }

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Rating saved successfully',
      rating: rating
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving rating:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving rating',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Set user's reading goal
// Set reading goal (requires active user)
router.post('/reading-goal', checkUserActivation, async (req, res) => {
  try {
    const { goal } = req.body;
    const userId = req.user.id;

    // Validate goal
    if (!goal || !Number.isInteger(goal) || goal < 1 || goal > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Goal must be an integer between 1 and 1000'
      });
    }

    // Use stored procedure to update reading goal
    const result = await pool.query('SELECT update_reading_goal($1, $2) as reading_goal', [userId, goal]);

    res.json({
      success: true,
      message: 'Reading goal updated successfully',
      reading_goal: result.rows[0].reading_goal
    });
  } catch (error) {
    console.error('Error updating reading goal:', error);
    
    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (error.message.includes('Goal must be between')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating reading goal'
    });
  }
});

// Get user's reading goal
router.get('/reading-goal', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const goalQuery = `
      SELECT reading_goal FROM users WHERE id = $1
    `;
    const result = await pool.query(goalQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      reading_goal: result.rows[0].reading_goal || 12
    });
  } catch (error) {
    console.error('Error fetching reading goal:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reading goal'
    });
  }
});

module.exports = router;