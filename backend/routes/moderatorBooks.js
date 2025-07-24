const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware to verify JWT token and moderator role
const verifyModerator = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    
    // Check if user exists and is moderator
    const userResult = await pool.query('SELECT u.id, u.username FROM users u JOIN moderator_accounts m ON u.id = m.user_id WHERE u.id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied. Moderator privileges required.' });
    }
    
    const user = userResult.rows[0];
    
    req.user = { id: decoded.id, role: 'moderator' };
    next();
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid token' });
  }
};

// Get all books with search and filtering
router.get('/books', verifyModerator, async (req, res) => {
  try {
    const { 
      q, // search query
      language, 
      genre, 
      author, 
      publisher, 
      country, 
      pubDateFrom, 
      pubDateTo, 
      ratingFrom, 
      ratingTo, 
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT DISTINCT
        b.id, b.title, b.description, b.publication_date, b.cover_image, b.original_country,
        b.language_id, b.publication_house_id, b.average_rating, b.isbn, b.readers_count, b.page,
        b.created_at, b.added_by, 
        STRING_AGG(DISTINCT a.name, ', ') as authors,
        STRING_AGG(DISTINCT g.name, ', ') as genres,
        l.name as language_name, 
        ph.name as publisher_name,
        u.username as added_by_username
      FROM books b
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        LEFT JOIN book_genres bg ON b.id = bg.book_id
        LEFT JOIN genres g ON bg.genre_id = g.id
        LEFT JOIN languages l ON b.language_id = l.id
        LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
        LEFT JOIN users u ON b.added_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Text search
    if (q && q.trim()) {
      query += ` AND (
        LOWER(b.title) LIKE $${paramIndex} OR 
        LOWER(b.description) LIKE $${paramIndex} OR
        LOWER(a.name) LIKE $${paramIndex}
      )`;
      params.push(`%${q.trim().toLowerCase()}%`);
      paramIndex++;
    }

    // Language filter
    if (language) {
      const languages = language.split(',').map(lang => lang.trim());
      const languagePlaceholders = languages.map(() => `$${paramIndex++}`).join(',');
      query += ` AND b.language_id IN (${languagePlaceholders})`;
      params.push(...languages);
    }

    // Genre filter
    if (genre) {
      const genres = genre.split(',').map(g => g.trim());
      const genrePlaceholders = genres.map(() => `$${paramIndex++}`).join(',');
      query += ` AND bg.genre_id IN (${genrePlaceholders})`;
      params.push(...genres);
    }

    // Author filter
    if (author) {
      const authors = author.split(',').map(auth => auth.trim());
      const authorPlaceholders = authors.map(() => `$${paramIndex++}`).join(',');
      query += ` AND ba.author_id IN (${authorPlaceholders})`;
      params.push(...authors);
    }

    // Publisher filter
    if (publisher) {
      const publishers = publisher.split(',').map(pub => pub.trim());
      const publisherPlaceholders = publishers.map(() => `$${paramIndex++}`).join(',');
      query += ` AND b.publication_house_id IN (${publisherPlaceholders})`;
      params.push(...publishers);
    }

    // Country filter
    if (country) {
      const countries = country.split(',').map(c => c.trim());
      const countryPlaceholders = countries.map(() => `$${paramIndex++}`).join(',');
      query += ` AND b.original_country IN (${countryPlaceholders})`;
      params.push(...countries);
    }

    // Publication date range
    if (pubDateFrom) {
      query += ` AND EXTRACT(YEAR FROM b.publication_date) >= $${paramIndex}`;
      params.push(parseInt(pubDateFrom));
      paramIndex++;
    }

    if (pubDateTo) {
      query += ` AND EXTRACT(YEAR FROM b.publication_date) <= $${paramIndex}`;
      params.push(parseInt(pubDateTo));
      paramIndex++;
    }

    // Rating range
    if (ratingFrom) {
      query += ` AND b.average_rating >= $${paramIndex}`;
      params.push(parseFloat(ratingFrom));
      paramIndex++;
    }

    if (ratingTo) {
      query += ` AND b.average_rating <= $${paramIndex}`;
      params.push(parseFloat(ratingTo));
      paramIndex++;
    }

    // Group by and sorting
    query += ` 
      GROUP BY b.id, b.title, b.description, b.publication_date, b.cover_image, b.original_country,
               b.language_id, b.publication_house_id, b.average_rating, b.isbn, b.readers_count, b.page,
               b.created_at, b.added_by, l.name, ph.name, u.username
      ORDER BY b.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), offset);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        LEFT JOIN book_genres bg ON b.id = bg.book_id
        LEFT JOIN genres g ON bg.genre_id = g.id
        LEFT JOIN languages l ON b.language_id = l.id
        LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
      WHERE 1=1
    `;

    // Apply same filters to count query
    const countParams = params.slice(0, -2); // Remove limit and offset
    if (q && q.trim()) {
      countQuery += ` AND (
        LOWER(b.title) LIKE $1 OR 
        LOWER(b.description) LIKE $1 OR
        LOWER(a.name) LIKE $1
      )`;
    }

    const [booksResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const totalBooks = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalBooks / limit);

    res.json({
      success: true,
      books: booksResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalBooks: totalBooks,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ success: false, message: 'Server error fetching books' });
  }
});

// Get single book with full details
router.get('/books/:id', verifyModerator, async (req, res) => {
  try {
    const { id } = req.params;

    const bookQuery = `
      SELECT 
        b.*,
        STRING_AGG(DISTINCT a.name, ', ') as authors,
        STRING_AGG(DISTINCT g.name, ', ') as genres,
        l.name as language_name,
        ph.name as publisher_name,
        u.username as added_by_username,
        COUNT(DISTINCT r.id) as review_count,
        COUNT(DISTINCT rt.id) as rating_count,
        COUNT(DISTINCT ub.id) as user_book_count
      FROM books b
        LEFT JOIN book_authors ba ON b.id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.id
        LEFT JOIN book_genres bg ON b.id = bg.book_id
        LEFT JOIN genres g ON bg.genre_id = g.id
        LEFT JOIN languages l ON b.language_id = l.id
        LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
        LEFT JOIN users u ON b.added_by = u.id
        LEFT JOIN reviews r ON b.id = r.book_id
        LEFT JOIN ratings rt ON b.id = rt.book_id
        LEFT JOIN user_books ub ON b.id = ub.book_id
      WHERE b.id = $1
      GROUP BY b.id, l.name, ph.name, u.username
    `;

    const bookResult = await pool.query(bookQuery, [id]);

    if (bookResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({
      success: true,
      book: bookResult.rows[0]
    });

  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ success: false, message: 'Server error fetching book' });
  }
});

// Update book
router.put('/books/:id', verifyModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, publication_date, cover_image, original_country,
      language_id, publication_house_id, isbn, page, authors, genres
    } = req.body;

    // Start transaction
    await pool.query('BEGIN');

    // Update book
    const updateQuery = `
      UPDATE books 
      SET title = $1, description = $2, publication_date = $3, cover_image = $4, 
          original_country = $5, language_id = $6, publication_house_id = $7, 
          isbn = $8, page = $9
      WHERE id = $10
      RETURNING *
    `;

    const bookResult = await pool.query(updateQuery, [
      title, description, publication_date, cover_image, original_country,
      language_id, publication_house_id, isbn, page, id
    ]);

    if (bookResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Update authors
    if (authors && Array.isArray(authors)) {
      await pool.query('DELETE FROM book_authors WHERE book_id = $1', [id]);
      
      for (const authorId of authors) {
        await pool.query('INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)', [id, authorId]);
      }
    }

    // Update genres
    if (genres && Array.isArray(genres)) {
      await pool.query('DELETE FROM book_genres WHERE book_id = $1', [id]);
      
      for (const genreId of genres) {
        await pool.query('INSERT INTO book_genres (book_id, genre_id) VALUES ($1, $2)', [id, genreId]);
      }
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Book updated successfully',
      book: bookResult.rows[0]
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating book:', error);
    res.status(500).json({ success: false, message: 'Server error updating book' });
  }
});

// Delete book
router.delete('/books/:id', verifyModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Check if book exists
    const bookCheck = await pool.query('SELECT title FROM books WHERE id = $1', [id]);
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const bookTitle = bookCheck.rows[0].title;

    // Update deletion reason in the deletion log (will be handled by trigger)
    // The trigger will automatically log all data before deletion
    await pool.query('DELETE FROM books WHERE id = $1', [id]);

    res.json({
      success: true,
      message: `Book "${bookTitle}" deleted successfully`,
      deletedBook: { id: parseInt(id), title: bookTitle }
    });

  } catch (error) {
    console.error('Error deleting book:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Server error deleting book', error: error.message });
  }
});

// Get deletion statistics
router.get('/deletion-stats', verifyModerator, async (req, res) => {
  try {
    const statsResult = await pool.query('SELECT * FROM get_book_deletion_stats()');
    
    res.json({
      success: true,
      stats: statsResult.rows[0]
    });

  } catch (error) {
    console.error('Error fetching deletion stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching deletion stats' });
  }
});

// Get deletion history
router.get('/deletion-history', verifyModerator, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const historyQuery = `
      SELECT 
        bdl.id,
        bdl.book_id,
        (bdl.book_data->>'title') as book_title,
        (bdl.book_data->>'authors') as authors,
        bdl.total_reviews,
        bdl.total_comments,
        bdl.total_ratings,
        bdl.total_user_books,
        bdl.deletion_reason,
        bdl.deleted_at,
        u.username as deleted_by_username
      FROM book_deletion_log bdl
      LEFT JOIN users u ON bdl.deleted_by = u.id
      ORDER BY bdl.deleted_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = 'SELECT COUNT(*) as total FROM book_deletion_log';

    const [historyResult, countResult] = await Promise.all([
      pool.query(historyQuery, [limit, offset]),
      pool.query(countQuery)
    ]);

    const totalDeletions = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalDeletions / limit);

    res.json({
      success: true,
      deletions: historyResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalDeletions: totalDeletions,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching deletion history:', error);
    res.status(500).json({ success: false, message: 'Server error fetching deletion history' });
  }
});

module.exports = router;