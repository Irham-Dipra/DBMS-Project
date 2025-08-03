const express = require('express');
const router = express.Router();
const pool = require('../db');
const { trackSearch } = require('../utils/searchTracker');

// Unified search endpoint: either regular text search OR filtered search
router.get('/', async (req, res) => {
  try {
    const { 
      q, 
      language, 
      genre, 
      author, 
      publisher, 
      country, 
      pubDateFrom, 
      pubDateTo, 
      ratingFrom, 
      ratingTo, 
      filtered 
    } = req.query;

    // Check if this is a filtered search
    const isFilteredSearch = filtered === 'true';
    
    // For regular text search, q is required
    if (!isFilteredSearch && (!q || q.trim().length === 0)) {
      return res.json({ success: true, data: {} });
    }

    const data = {};

    if (isFilteredSearch) {
      // FILTERED SEARCH - only books with filters applied
      let bookQuery = `
        SELECT DISTINCT
          b.id, b.title, b.description, b.publication_date, b.cover_image, b.original_country,
          b.language_id, b.publication_house_id, b.average_rating,
          b.created_at, b.added_by, a.name as "author_name",
          l.name as "language_name", ph.name as "publisher_name",
          (
          SELECT array_agg(DISTINCT g.name ORDER BY g.name)
          FROM genres g
          JOIN book_genres bg ON g.id = bg.genre_id
          WHERE bg.book_id = b.id
        ) as genres

        FROM books b
          JOIN book_authors ba ON b.id = ba.book_id
          JOIN authors a ON ba.author_id = a.id
          LEFT JOIN languages l ON b.language_id = l.id
          LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
        WHERE 1=1
      `;

      const queryParams = [];
      let paramIndex = 1;

      // Language filter
      if (language) {
        const languages = language.split(',').map(lang => lang.trim());
        const languagePlaceholders = languages.map(() => `$${paramIndex++}`).join(',');
        bookQuery += ` AND b.language_id IN (${languagePlaceholders})`;
        queryParams.push(...languages);
      }

      // Genre filter - using proper many-to-many relationship
      if (genre) {
        const genres = genre.split(',').map(g => g.trim());
        const genrePlaceholders = genres.map(() => `$${paramIndex++}`).join(',');
        bookQuery += ` AND EXISTS (
          SELECT 1 FROM book_genres bg 
          WHERE bg.book_id = b.id 
          AND bg.genre_id IN (${genrePlaceholders})
        )`;
        queryParams.push(...genres);
      }

      // Author filter
      if (author) {
        const authors = author.split(',').map(auth => auth.trim());
        const authorPlaceholders = authors.map(() => `$${paramIndex++}`).join(',');
        bookQuery += ` AND ba.author_id IN (${authorPlaceholders})`;
        queryParams.push(...authors);
      }

      // Publisher filter
      if (publisher) {
        const publishers = publisher.split(',').map(pub => pub.trim());
        const publisherPlaceholders = publishers.map(() => `$${paramIndex++}`).join(',');
        bookQuery += ` AND b.publication_house_id IN (${publisherPlaceholders})`;
        queryParams.push(...publishers);
      }

      // Country filter
      if (country) {
        const countries = country.split(',').map(c => c.trim());
        const countryPlaceholders = countries.map(() => `$${paramIndex++}`).join(',');
        bookQuery += ` AND b.original_country IN (${countryPlaceholders})`;
        queryParams.push(...countries);
      }

      // Publication date range filter
      if (pubDateFrom) {
        bookQuery += ` AND EXTRACT(YEAR FROM b.publication_date) >= $${paramIndex}`;
        queryParams.push(parseInt(pubDateFrom));
        paramIndex++;
      }

      if (pubDateTo) {
        bookQuery += ` AND EXTRACT(YEAR FROM b.publication_date) <= $${paramIndex}`;
        queryParams.push(parseInt(pubDateTo));
        paramIndex++;
      }

      // Rating range filter
      if (ratingFrom) {
        bookQuery += ` AND b.average_rating >= $${paramIndex}`;
        queryParams.push(parseFloat(ratingFrom));
        paramIndex++;
      }

      if (ratingTo) {
        bookQuery += ` AND b.average_rating <= $${paramIndex}`;
        queryParams.push(parseFloat(ratingTo));
        paramIndex++;
      }

      // Add ordering and limit
      bookQuery += ` ORDER BY b.average_rating DESC, b.title ASC LIMIT 50`;

      // Execute filtered books query
      const booksResult = await pool.query(bookQuery, queryParams);
      if (booksResult.rows.length > 0) data.books = booksResult.rows;

      // Track filtered search
      await trackSearch(req, 'filtered_search', null, {
        language, genre, author, publisher, country, 
        pubDateFrom, pubDateTo, ratingFrom, ratingTo
      }, data);

      res.json({
        success: true,
        message: 'Filtered results fetched successfully',
        data,
        totalBooks: booksResult.rows.length,
        isFiltered: true
      });

    } else {
      // REGULAR TEXT SEARCH - books, authors, and characters
      const keyword = `%${q.trim().toLowerCase()}%`;

      // Search Books
      const bookQuery = `
        SELECT
          b.id, b.title, b.description, b.publication_date, b.cover_image, b.original_country,
          b.language_id, b.publication_house_id, b.average_rating,
          b.created_at, b.added_by, a.name as "author_name",
          (
            SELECT array_agg(DISTINCT g.name ORDER BY g.name)
            FROM genres g
            JOIN book_genres bg ON g.id = bg.genre_id
            WHERE bg.book_id = b.id
          ) as genres,
          POSITION(LOWER($2) IN LOWER(b.title)) as match_position
        FROM books b
          JOIN book_authors ba ON b.id = ba.book_id
          JOIN authors a ON ba.author_id = a.id
        WHERE LOWER(b.title) LIKE $1
        ORDER BY 
          CASE WHEN POSITION(LOWER($2) IN LOWER(b.title)) = 1 THEN 0 ELSE 1 END,
          POSITION(LOWER($2) IN LOWER(b.title)),
          b.average_rating DESC, 
          b.title ASC
        LIMIT 20;
      `;
      const booksResult = await pool.query(bookQuery, [keyword, q.trim().toLowerCase()]);
      if (booksResult.rows.length > 0) data.books = booksResult.rows;

      // Search Authors
      const authorQuery = `
        SELECT a.id, a.name, a.bio, a.author_image,
               POSITION(LOWER($2) IN LOWER(a.name)) as match_position,
               (
                 SELECT b.cover_image 
                 FROM books b 
                 JOIN book_authors ba ON b.id = ba.book_id 
                 WHERE ba.author_id = a.id 
                 AND b.cover_image IS NOT NULL 
                 ORDER BY b.id ASC 
                 LIMIT 1
               ) as first_book_cover
        FROM authors a
        WHERE LOWER(a.name) LIKE $1
        ORDER BY 
          CASE WHEN POSITION(LOWER($2) IN LOWER(a.name)) = 1 THEN 0 ELSE 1 END,
          POSITION(LOWER($2) IN LOWER(a.name)),
          a.name ASC
        LIMIT 20;
      `;
      const authorsResult = await pool.query(authorQuery, [keyword, q.trim().toLowerCase()]);
      if (authorsResult.rows.length > 0) data.authors = authorsResult.rows;

      // Search Characters - FIXED: table name
      const characterQuery = `
        SELECT c.id, c.name, c.biography as description,
               POSITION(LOWER($2) IN LOWER(c.name)) as match_position,
               (
                 SELECT b.cover_image 
                 FROM books b 
                 JOIN book_character_appearances bca ON b.id = bca.book_id 
                 WHERE bca.character_id = c.id 
                 AND b.cover_image IS NOT NULL 
                 ORDER BY b.id ASC 
                 LIMIT 1
               ) as first_book_cover
        FROM characters c
        WHERE LOWER(c.name) LIKE $1
        ORDER BY 
          CASE WHEN POSITION(LOWER($2) IN LOWER(c.name)) = 1 THEN 0 ELSE 1 END,
          POSITION(LOWER($2) IN LOWER(c.name)),
          c.name ASC
        LIMIT 20;
      `;
      const charactersResult = await pool.query(characterQuery, [keyword, q.trim().toLowerCase()]);
      if (charactersResult.rows.length > 0) data.characters = charactersResult.rows;

      // Search Users
      const userQuery = `
        SELECT u.id, u.username, u.first_name, u.last_name, u.bio, 
               u.profile_picture_url, u.created_at,
               POSITION(LOWER($2) IN LOWER(u.username)) as username_match_position,
               POSITION(LOWER($2) IN LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))) as name_match_position,
               EXISTS(SELECT 1 FROM moderator_accounts m WHERE m.user_id = u.id) AS is_moderator
        FROM users u
        WHERE u.is_active = true 
        AND (
          LOWER(u.username) LIKE $1 
          OR LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE $1
          OR LOWER(COALESCE(u.first_name, '')) LIKE $1
          OR LOWER(COALESCE(u.last_name, '')) LIKE $1
        )
        ORDER BY 
          CASE 
            WHEN POSITION(LOWER($2) IN LOWER(u.username)) = 1 THEN 0 
            WHEN POSITION(LOWER($2) IN LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))) = 1 THEN 1
            ELSE 2 
          END,
          LEAST(
            COALESCE(POSITION(LOWER($2) IN LOWER(u.username)), 999),
            COALESCE(POSITION(LOWER($2) IN LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))), 999)
          ),
          u.username ASC
        LIMIT 20;
      `;
      const usersResult = await pool.query(userQuery, [keyword, q.trim().toLowerCase()]);
      if (usersResult.rows.length > 0) data.users = usersResult.rows;

      // Track text search
      await trackSearch(req, 'text_search', q.trim(), null, data);

      res.json({
        success: true,
        message: 'Search results fetched successfully',
        data,
        query: q.trim(),
        isFiltered: false
      });
    }

  } catch (err) {
    console.error('Error in /search:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search results',
      error: err.message
    });
  }
});

module.exports = router;