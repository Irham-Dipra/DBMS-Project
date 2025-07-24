const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { checkUserActivation, optionalUserActivationCheck } = require('../middleware/userActivationCheck');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware to verify JWT token (kept for backwards compatibility where activation check isn't needed)
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

// POST /reviews - Create a new review (requires active user)
router.post('/', checkUserActivation, async (req, res) => {
  const { user_id, book_id, title, body, rating } = req.body;

  if (!user_id || !book_id || !title || !body || !rating) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Validate rating
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
  }

  try {
    // Use a transaction to ensure both review and rating are saved together
    await pool.query('BEGIN');

    // Insert the review
    const result = await pool.query(
      `INSERT INTO reviews (user_id, book_id, title, body, rating, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [user_id, book_id, title, body, rating]
    );

    // Insert or update the rating in the ratings table
    // First check if rating exists, then update or insert
    const existingRating = await pool.query(
      `SELECT id FROM ratings WHERE user_id = $1 AND book_id = $2`,
      [user_id, book_id]
    );

    if (existingRating.rows.length > 0) {
      // Update existing rating
      await pool.query(
        `UPDATE ratings SET value = $1, created_at = NOW() WHERE user_id = $2 AND book_id = $3`,
        [rating, user_id, book_id]
      );
    } else {
      // Insert new rating
      await pool.query(
        `INSERT INTO ratings (user_id, book_id, value, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [user_id, book_id, rating]
      );
    }

    await pool.query('COMMIT');

    res.status(201).json({
      message: '✅ Review added successfully',
      review: result.rows[0],
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Error inserting review:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /reviews/user - Get all reviews by the authenticated user
router.get('/user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        r.id, 
        r.book_id, 
        r.user_id, 
        r.title as review_title, 
        r.body, 
        r.rating, 
        r.created_at, 
        r.updated_at,
        b.title as book_title,
        b.cover_image,
        a.name as author_name
      FROM reviews r
      JOIN books b ON r.book_id = b.id
      JOIN book_authors ba ON b.id = ba.book_id
      JOIN authors a ON ba.author_id = a.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      reviews: result.rows
    });
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reviews',
      error: err.message 
    });
  }
});

// GET /reviews/book/:bookId - Get all reviews for a specific book
router.get('/book/:bookId', async (req, res) => {
  const { bookId } = req.params;

  console.log('📖 Fetching reviews for book ID:', bookId);

  try {
    const result = await pool.query(
      `SELECT 
        r.id, 
        r.book_id, 
        r.user_id, 
        r.title, 
        r.body, 
        r.rating, 
        r.created_at, 
        r.updated_at,
        u.username as user_name,
        u.first_name,
        u.last_name,
        u.profile_picture_url
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.book_id = $1
      ORDER BY r.created_at DESC`,
      [bookId]
    );

    console.log('✅ Reviews fetched successfully:', result.rows.length, 'reviews found');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching reviews:', err);
    console.error('❌ Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
      routine: err.routine
    });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /reviews/all - Get all reviews with vote counts and comments for browse page
router.get('/all', async (req, res) => {
  try {
    // Get user ID from token (optional)
    let currentUserId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        currentUserId = decoded.id;
      } catch (error) {
        // Token invalid, continue without user data
      }
    }

    const result = await pool.query(`
      SELECT 
        r.id, 
        r.book_id, 
        r.user_id, 
        r.title, 
        r.body, 
        r.rating, 
        r.created_at, 
        r.updated_at,
        r.upvotes,
        r.downvotes,
        u.username as user_name,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        b.title as book_title,
        a.name as author_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN books b ON r.book_id = b.id
      JOIN book_authors ba ON b.id = ba.book_id
      JOIN authors a ON ba.author_id = a.id
      ORDER BY r.created_at DESC
    `);

    // Get comments and user votes for each review
    const reviewsWithComments = await Promise.all(
      result.rows.map(async (review) => {
        // Get comments with vote counts and user votes (only parent comments)
        const commentsResult = await pool.query(`
          SELECT 
            c.id,
            c.body as comment,
            c.created_at,
            c.upvotes,
            c.downvotes,
            c.reply_count,
            u.username as user_name,
            u.first_name,
            u.last_name,
            u.profile_picture_url
          FROM comments c
          JOIN users u ON c.user_id = u.id
          WHERE c.review_id = $1 AND c.parent_comment_id IS NULL
          ORDER BY (c.upvotes - c.downvotes) DESC, c.created_at ASC
        `, [review.id]);

        // Get current user's votes on comments if logged in
        const commentsWithVotes = await Promise.all(
          commentsResult.rows.map(async (comment) => {
            let userVote = null;
            if (currentUserId) {
              const voteResult = await pool.query(
                'SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2',
                [comment.id, currentUserId]
              );
              userVote = voteResult.rows.length > 0 ? voteResult.rows[0].vote_type : null;
            }
            return {
              ...comment,
              user_vote: userVote
            };
          })
        );

        // Get current user's vote if logged in
        let userVote = null;
        if (currentUserId) {
          const voteResult = await pool.query(
            'SELECT vote_type FROM votes WHERE review_id = $1 AND user_id = $2',
            [review.id, currentUserId]
          );
          userVote = voteResult.rows.length > 0 ? voteResult.rows[0].vote_type : null;
        }

        return {
          ...review,
          comments: commentsWithVotes,
          user_vote: userVote
        };
      })
    );

    res.json(reviewsWithComments);
  } catch (err) {
    console.error('❌ Error fetching all reviews:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /reviews/:reviewId/vote - Vote on a review
// POST /reviews/:reviewId/vote - Vote on a review (requires active user)
router.post('/:reviewId/vote', checkUserActivation, async (req, res) => {
  const { reviewId } = req.params;
  const { vote_type } = req.body;
  
  // Get user ID from token
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Validate vote type
    if (!['upvote', 'downvote'].includes(vote_type)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    await pool.query('BEGIN');

    // Check if user already voted on this review
    const existingVote = await pool.query(
      'SELECT vote_type FROM votes WHERE review_id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    if (existingVote.rows.length > 0) {
      const currentVote = existingVote.rows[0].vote_type;
      
      if (currentVote === vote_type) {
        // Remove vote (user clicked same button)
        await pool.query(
          'DELETE FROM votes WHERE review_id = $1 AND user_id = $2',
          [reviewId, userId]
        );
      } else {
        // Update vote (user switched from upvote to downvote or vice versa)
        await pool.query(
          'UPDATE votes SET vote_type = $1, updated_at = NOW() WHERE review_id = $2 AND user_id = $3',
          [vote_type, reviewId, userId]
        );
      }
    } else {
      // Insert new vote
      await pool.query(
        'INSERT INTO votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [reviewId, userId, vote_type]
      );
    }

    // Update vote counts in reviews table
    const voteCounts = await pool.query(`
      SELECT 
        COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END) as upvotes,
        COUNT(CASE WHEN vote_type = 'downvote' THEN 1 END) as downvotes
      FROM votes 
      WHERE review_id = $1
    `, [reviewId]);

    await pool.query(
      'UPDATE reviews SET upvotes = $1, downvotes = $2 WHERE id = $3',
      [voteCounts.rows[0].upvotes, voteCounts.rows[0].downvotes, reviewId]
    );

    // Get current user's vote
    const userVote = await pool.query(
      'SELECT vote_type FROM votes WHERE review_id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      upvotes: parseInt(voteCounts.rows[0].upvotes),
      downvotes: parseInt(voteCounts.rows[0].downvotes),
      user_vote: userVote.rows.length > 0 ? userVote.rows[0].vote_type : null
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Error voting on review:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /reviews/:reviewId/comment - Add a comment to a review
// POST /reviews/:reviewId/comment - Add comment to review (requires active user)
router.post('/:reviewId/comment', checkUserActivation, async (req, res) => {
  const { reviewId } = req.params;
  const { comment, parent_comment_id } = req.body;
  
  // Get user ID from token
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    await pool.query('BEGIN');

    // Insert comment into comments table
    const result = await pool.query(
      `INSERT INTO comments (review_id, user_id, body, parent_comment_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, body, created_at`,
      [reviewId, userId, comment.trim(), parent_comment_id || null]
    );

    // If this is a reply, update the parent comment's reply count
    if (parent_comment_id) {
      await pool.query(
        `UPDATE comments SET reply_count = reply_count + 1 WHERE id = $1`,
        [parent_comment_id]
      );
    }

    await pool.query('COMMIT');

    // Get user info for the response
    const userInfo = await pool.query(
      'SELECT username, first_name, last_name, profile_picture_url FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      comment: {
        id: result.rows[0].id,
        comment: result.rows[0].body,
        created_at: result.rows[0].created_at,
        upvotes: 0,
        downvotes: 0,
        reply_count: 0,
        user_name: userInfo.rows[0].username,
        first_name: userInfo.rows[0].first_name,
        last_name: userInfo.rows[0].last_name,
        profile_picture_url: userInfo.rows[0].profile_picture_url,
        parent_comment_id: parent_comment_id || null
      }
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Error adding comment:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /reviews/comments/:commentId/replies - Get replies to a comment
router.get('/comments/:commentId/replies', async (req, res) => {
  const { commentId } = req.params;
  
  try {
    // Get user ID from token (optional)
    let currentUserId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        currentUserId = decoded.id;
      } catch (error) {
        // Token invalid, continue without user data
      }
    }

    const repliesResult = await pool.query(`
      SELECT 
        c.id,
        c.body as comment,
        c.created_at,
        c.upvotes,
        c.downvotes,
        c.reply_count,
        u.username as user_name,
        u.first_name,
        u.last_name,
        u.profile_picture_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      ORDER BY c.created_at ASC
    `, [commentId]);

    // Get current user's votes on replies if logged in
    const repliesWithVotes = await Promise.all(
      repliesResult.rows.map(async (reply) => {
        let userVote = null;
        if (currentUserId) {
          const voteResult = await pool.query(
            'SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2',
            [reply.id, currentUserId]
          );
          userVote = voteResult.rows.length > 0 ? voteResult.rows[0].vote_type : null;
        }
        return {
          ...reply,
          user_vote: userVote
        };
      })
    );

    res.json({
      success: true,
      replies: repliesWithVotes
    });

  } catch (err) {
    console.error('❌ Error fetching replies:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /reviews/comments/:commentId/vote - Vote on a comment
// POST /reviews/comments/:commentId/vote - Vote on comment (requires active user)
router.post('/comments/:commentId/vote', checkUserActivation, async (req, res) => {
  const { commentId } = req.params;
  const { vote_type } = req.body;
  
  // Get user ID from token
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Validate vote type
    if (!['upvote', 'downvote'].includes(vote_type)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    await pool.query('BEGIN');

    // Check if user already voted on this comment
    const existingVote = await pool.query(
      'SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (existingVote.rows.length > 0) {
      const currentVote = existingVote.rows[0].vote_type;
      
      if (currentVote === vote_type) {
        // Remove vote (user clicked same button)
        await pool.query(
          'DELETE FROM votes WHERE comment_id = $1 AND user_id = $2',
          [commentId, userId]
        );
      } else {
        // Update vote (user switched from upvote to downvote or vice versa)
        await pool.query(
          'UPDATE votes SET vote_type = $1, updated_at = NOW() WHERE comment_id = $2 AND user_id = $3',
          [vote_type, commentId, userId]
        );
      }
    } else {
      // Insert new vote
      await pool.query(
        'INSERT INTO votes (comment_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [commentId, userId, vote_type]
      );
    }

    // Update vote counts in comments table
    const voteCounts = await pool.query(`
      SELECT 
        COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END) as upvotes,
        COUNT(CASE WHEN vote_type = 'downvote' THEN 1 END) as downvotes
      FROM votes 
      WHERE comment_id = $1
    `, [commentId]);

    await pool.query(
      'UPDATE comments SET upvotes = $1, downvotes = $2 WHERE id = $3',
      [voteCounts.rows[0].upvotes, voteCounts.rows[0].downvotes, commentId]
    );

    // Get current user's vote
    const userVote = await pool.query(
      'SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      upvotes: parseInt(voteCounts.rows[0].upvotes),
      downvotes: parseInt(voteCounts.rows[0].downvotes),
      user_vote: userVote.rows.length > 0 ? userVote.rows[0].vote_type : null
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Error voting on comment:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;