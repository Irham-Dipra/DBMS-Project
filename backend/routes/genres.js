const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// GET /genres/:id - Get genre details with books
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = 'title', order = 'asc' } = req.query;
    
    // Check if user is authenticated (optional for public genre pages)
    let userId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Token invalid, but we'll continue without user data
        console.log('Invalid token provided, continuing without user data');
      }
    }

    // Get genre details
    const genreQuery = `
      SELECT 
        id,
        name
      FROM genres 
      WHERE id = $1
    `;
    
    const genreResult = await pool.query(genreQuery, [id]);
    
    if (genreResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Genre not found'
      });
    }

    const genre = genreResult.rows[0];

    // Get total count of books for this genre
    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
      JOIN book_genres bg ON b.id = bg.book_id
      WHERE bg.genre_id = $1
    `;
    
    const countResult = await pool.query(countQuery, [id]);
    const totalBooks = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get books for this genre with user data if authenticated
    const userSelect = userId ? `, ub.shelf, rt.value as user_rating` : `, null as shelf, null as user_rating`;
    const userJoin = userId ? `LEFT JOIN user_books ub ON b.id = ub.book_id AND ub.user_id = ${userId}` : '';
    const ratingJoin = userId ? `LEFT JOIN ratings rt ON b.id = rt.book_id AND rt.user_id = ${userId}` : '';
    
    // Validate sort field
    const validSortFields = ['title', 'publication_date', 'average_rating', 'author'];
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    
    let orderByClause;
    switch (sortField) {
      case 'author':
        orderByClause = `(SELECT a.name FROM authors a 
                        JOIN book_authors ba ON a.id = ba.author_id 
                        WHERE ba.book_id = b.id 
                        ORDER BY a.id ASC LIMIT 1) ${sortOrder}`;
        break;
      case 'publication_date':
        orderByClause = `b.publication_date ${sortOrder} NULLS LAST`;
        break;
      case 'average_rating':
        orderByClause = `b.average_rating ${sortOrder} NULLS LAST`;
        break;
      default:
        orderByClause = `b.title ${sortOrder}`;
    }
    
    const booksQuery = `
      SELECT 
        b.id,
        b.title,
        b.description,
        b.publication_date,
        b.cover_image,
        b.average_rating,
        (SELECT a.name FROM authors a 
         JOIN book_authors ba ON a.id = ba.author_id 
         WHERE ba.book_id = b.id 
         ORDER BY a.id ASC LIMIT 1) as author_name,
        (SELECT a.id FROM authors a 
         JOIN book_authors ba ON a.id = ba.author_id 
         WHERE ba.book_id = b.id 
         ORDER BY a.id ASC LIMIT 1) as author_id,
        l.name as language_name,
        ph.name as publisher_name
        ${userSelect}
      FROM books b
      JOIN book_genres bg ON b.id = bg.book_id
      LEFT JOIN languages l ON b.language_id = l.id
      LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
      ${userJoin}
      ${ratingJoin}
      WHERE bg.genre_id = $1
      ORDER BY ${orderByClause}
      LIMIT $2 OFFSET $3
    `;

    const booksResult = await pool.query(booksQuery, [id, limit, offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalBooks / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        genre,
        books: booksResult.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBooks,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching genre details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching genre details',
      error: error.message
    });
  }
});

// GET /genres - Get all genres (for search/browse functionality)
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        g.id,
        g.name,
        COUNT(bg.book_id) as book_count
      FROM genres g
      LEFT JOIN book_genres bg ON g.id = bg.genre_id
    `;
    
    const queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` WHERE g.name ILIKE $${paramCount}`;
      queryParams.push(`%${search}%`);
    }

    query += ` GROUP BY g.id, g.name`;
    query += ` ORDER BY g.name ASC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset));

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: {
        genres: result.rows,
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching genres',
      error: error.message
    });
  }
});

module.exports = router;
