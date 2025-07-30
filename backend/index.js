require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const wishlistRoutes = require('./routes/wishlist');
const searchRoutes = require('./routes/search');
const filterOptionsRoutes = require('./routes/filter-options');
const addBookRoutes = require('./routes/addBook');
const reviewRoutes = require('./routes/reviews');
const userBooksRoutes = require('./routes/userBooks');
const authorRoutes = require('./routes/authors');
const genreRoutes = require('./routes/genres');
const analyticsRoutes = require('./routes/analytics');
const moderatorBooksRoutes = require('./routes/moderatorBooks');
const userManagementRoutes = require('./routes/userManagement');
const reactivationScheduler = require('./utils/scheduler');



app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/', homeRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/search', searchRoutes);
app.use('/filter-options', filterOptionsRoutes);
app.use('/addBook', addBookRoutes);
app.use('/reviews', reviewRoutes);
app.use('/myBooks', userBooksRoutes);
app.use('/authors', authorRoutes);
app.use('/genres', genreRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/moderator', moderatorBooksRoutes);
app.use('/moderator', userManagementRoutes);

app.get('/books/:id', async (req, res) => {
  const { id } = req.params; 
  try {
    // Check if user is authenticated (optional)
    let userId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Token invalid, but we'll continue without user data
        console.log('Invalid token provided, continuing without user data');
      }
    }

    // Base query for book details
    let query = `
      SELECT
        b.id, b.title, b.description, b.publication_date, b.cover_image, b.original_country,
        b.language_id, b.publication_house_id, b.average_rating,
        b.created_at, b.added_by, 
        a.id as "author_id", a.name as "author_name", a.bio as "author_bio",
        l.name as "language_name", l.iso_code as "language_code",
        ph.name as "publisher_name",
        (
          SELECT array_agg(DISTINCT g.name ORDER BY g.name)
          FROM genres g
          JOIN book_genres bg ON g.id = bg.genre_id
          WHERE bg.book_id = b.id
        ) as genres
    `;

    // If user is authenticated, include their rating and shelf (can be null)
    if (userId) {
      query += `, ub.shelf, rt.value as user_rating`;
    } else {
      query += `, null as shelf, null as user_rating`;
    }

    query += `
      FROM books b
        JOIN book_authors ba ON b.id = ba.book_id
        JOIN authors a ON ba.author_id = a.id
        LEFT JOIN languages l ON b.language_id = l.id
        LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
    `;

    if (userId) {
      query += ` LEFT JOIN user_books ub ON b.id = ub.book_id AND ub.user_id = $2`;
      query += ` LEFT JOIN ratings rt ON b.id = rt.book_id AND rt.user_id = $2`;
    }

    query += ` WHERE b.id = $1`;

    const queryParams = userId ? [id, userId] : [id];
    
    const book = await pool.query(query, queryParams);
    
    if (book.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Book not found' 
      });
    }

    const bookData = book.rows[0];

    // Get genre details with IDs for clickable genres
    const genreDetailsQuery = `
      SELECT g.id, g.name
      FROM genres g
      JOIN book_genres bg ON g.id = bg.genre_id
      WHERE bg.book_id = $1
      ORDER BY g.name
    `;
    
    const genreDetails = await pool.query(genreDetailsQuery, [id]);
    bookData.genre_details = genreDetails.rows;

    // Get other books by the same author
    const otherBooksQuery = `
      SELECT 
        b.id,
        b.title,
        b.cover_image,
        b.average_rating,
        b.publication_date,
        ${userId ? 'ub.shelf, rt.value as user_rating' : 'null as shelf, null as user_rating'}
      FROM books b
      JOIN book_authors ba ON b.id = ba.book_id
      ${userId ? 'LEFT JOIN user_books ub ON b.id = ub.book_id AND ub.user_id = $2' : ''}
      ${userId ? 'LEFT JOIN ratings rt ON b.id = rt.book_id AND rt.user_id = $2' : ''}
      WHERE ba.author_id = $1 AND b.id != $${userId ? '3' : '2'}
      ORDER BY b.publication_date DESC, b.id ASC
      LIMIT 10
    `;

    const otherBooksParams = userId ? [bookData.author_id, userId, id] : [bookData.author_id, id];
    const otherBooks = await pool.query(otherBooksQuery, otherBooksParams);

    // Add other books to the response
    bookData.other_books = otherBooks.rows;

    res.json(bookData);
  } catch (err) {
    console.error('Error in book details endpoint:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching book details',
      error: err.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
  
  // Start the user reactivation scheduler
  reactivationScheduler.start();
});




