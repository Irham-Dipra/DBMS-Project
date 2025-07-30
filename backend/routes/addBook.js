// backend/routes/addBook.js
const express = require('express');
const pool = require('../db'); 
const router = express.Router();

// Store active transactions per session
const activeSessions = new Map();

// Start a new book addition session
router.post('/start-session', async (req, res) => {
  const { userId } = req.body;
  
  console.log('Start session request:', { userId }); // Debug log
  
  if (!userId) {
    console.log('User ID is missing');
    return res.status(400).json({ success: false, message: 'User ID required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessionId = `session_${userId}_${Date.now()}`;
    activeSessions.set(sessionId, { client, addedItems: [] });
    
    console.log('Session created successfully:', sessionId);
    console.log('Active sessions count:', activeSessions.size);
    
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error starting session:', error);
    client.release();
    res.status(500).json({ success: false, message: 'Error starting session: ' + error.message });
  }
});

// Rollback session
router.post('/rollback-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ success: false, message: 'Invalid session' });
  }
  
  const session = activeSessions.get(sessionId);
  try {
    await session.client.query('ROLLBACK');
    session.client.release();
    activeSessions.delete(sessionId);
    res.json({ success: true, message: 'Session rolled back' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error rolling back session' });
  }
});

// Commit session
router.post('/commit-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ success: false, message: 'Invalid session' });
  }
  
  const session = activeSessions.get(sessionId);
  try {
    await session.client.query('COMMIT');
    session.client.release();
    activeSessions.delete(sessionId);
    res.json({ success: true, message: 'Session committed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error committing session' });
  }
});

// === GENRES ===
router.get('/genres', async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT id, name FROM genres';
    let params = [];
    
    if (search) {
      // Search with prefix priority: names starting with search term come first
      query += ` WHERE LOWER(name) LIKE LOWER($1)
                 ORDER BY 
                   CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
                   name`;
      params = [`%${search}%`, `${search}%`];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching genres' });
  }
});

router.post('/genres', async (req, res) => {
  const { name, sessionId } = req.body;
  
  console.log('Genre POST request received:', { name, sessionId }); // Debug log
  
  if (!name) {
    console.log('Genre name is missing');
    return res.status(400).json({ success: false, message: 'Genre name required' });
  }
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    console.log('Invalid session:', { sessionId, hasSession: activeSessions.has(sessionId) });
    return res.status(400).json({ success: false, message: 'Valid session required' });
  }
  
  const session = activeSessions.get(sessionId);
  console.log('Session found, attempting to insert genre');
  
  try {
    const trimmedName = name.trim();
    console.log('Inserting genre with name:', trimmedName);
    
    const result = await session.client.query(
      'INSERT INTO genres (name) VALUES ($1) RETURNING id, name', 
      [trimmedName]
    );
    
    console.log('Genre insertion successful:', result.rows[0]);
    
    session.addedItems.push({ type: 'genre', id: result.rows[0].id });
    res.status(201).json({ success: true, genre: result.rows[0], autoNext: true });
  } catch (error) {
    console.error('Error inserting genre:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ success: false, message: 'Genre already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Error adding genre: ' + error.message });
    }
  }
});

// === LANGUAGES ===
router.get('/languages', async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT id, name, iso_code FROM languages';
    let params = [];
    
    if (search) {
      query += ` WHERE LOWER(name) LIKE LOWER($1)
                 ORDER BY 
                   CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
                   name`;
      params = [`%${search}%`, `${search}%`];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching languages' });
  }
});

router.post('/languages', async (req, res) => {
  const { name, iso_code, sessionId } = req.body;
  
  console.log('Language POST request received:', { name, iso_code, sessionId }); // Debug log
  
  if (!name || !iso_code) {
    console.log('Missing required fields:', { name, iso_code });
    return res.status(400).json({ 
      success: false, 
      message: 'Both language name and ISO code are required' 
    });
  }
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    console.log('Invalid session:', { sessionId, hasSession: activeSessions.has(sessionId) });
    return res.status(400).json({ success: false, message: 'Valid session required' });
  }
  
  const session = activeSessions.get(sessionId);
  console.log('Session found, attempting to insert language');
  
  try {
    const trimmedName = name.trim();
    const trimmedIsoCode = iso_code.trim().toUpperCase(); // Standardize to uppercase
    
    console.log('Inserting language:', { name: trimmedName, iso_code: trimmedIsoCode });
    
    const result = await session.client.query(
      'INSERT INTO languages (name, iso_code) VALUES ($1, $2) RETURNING id, name, iso_code', 
      [trimmedName, trimmedIsoCode]
    );
    
    console.log('Language insertion successful:', result.rows[0]);
    
    session.addedItems.push({ type: 'language', id: result.rows[0].id });
    res.status(201).json({ success: true, language: result.rows[0] });
  } catch (error) {
    console.error('Error inserting language:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'languages_iso_code_key') {
        res.status(400).json({ success: false, message: 'ISO code already exists' });
      } else {
        res.status(400).json({ success: false, message: 'Language already exists' });
      }
    } else {
      res.status(500).json({ success: false, message: 'Error adding language: ' + error.message });
    }
  }
});

// === PUBLICATION HOUSES ===
router.get('/publication_houses', async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT id, name FROM publication_houses';
    let params = [];
    
    if (search) {
      query += ` WHERE LOWER(name) LIKE LOWER($1)
                 ORDER BY 
                   CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
                   name`;
      params = [`%${search}%`, `${search}%`];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching publication houses:', error);
    res.status(500).json({ success: false, message: 'Error fetching publication houses' });
  }
});

router.post('/publication_houses', async (req, res) => {
  const { name, sessionId } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Publication house name required' });
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ success: false, message: 'Valid session required' });
  }
  
  const session = activeSessions.get(sessionId);
  try {
    const result = await session.client.query('INSERT INTO publication_houses (name) VALUES ($1) RETURNING id, name', [name.trim()]);
    session.addedItems.push({ type: 'publication_house', id: result.rows[0].id });
    res.status(201).json({ success: true, publication_house: result.rows[0] });
  } catch (error) {
    console.error('Error adding publication house:', error);
    res.status(500).json({ success: false, message: 'Error adding publication house' });
  }
});

// === AUTHORS ===
router.get('/authors', async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT id, name FROM authors';
    let params = [];
    
    if (search) {
      query += ` WHERE LOWER(name) LIKE LOWER($1)
                 ORDER BY 
                   CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
                   name`;
      params = [`%${search}%`, `${search}%`];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching authors:', error);
    res.status(500).json({ success: false, message: 'Error fetching authors' });
  }
});

router.post('/authors', async (req, res) => {
  const { name, bio, sessionId } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Author name required' });
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ success: false, message: 'Valid session required' });
  }
  
  const session = activeSessions.get(sessionId);
  try {
    const result = await session.client.query('INSERT INTO authors (name, bio) VALUES ($1, $2) RETURNING id, name', [name.trim(), bio || '']);
    session.addedItems.push({ type: 'author', id: result.rows[0].id });
    res.status(201).json({ success: true, author: result.rows[0] });
  } catch (error) {
    console.error('Error adding author:', error);
    res.status(500).json({ success: false, message: 'Error adding author' });
  }
});

// === ADD BOOK ===
router.post('/books', async (req, res) => {
  const {
    title,
    description,
    publication_date,
    cover_image,
    original_country,
    page,
    genre_id,
    language_id,
    publication_house_id,
    author_ids,
    added_by,
    sessionId
  } = req.body;

  if (!title || !genre_id || !language_id || !publication_house_id || !author_ids || !added_by) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ success: false, message: 'Valid session required' });
  }

  const session = activeSessions.get(sessionId);
  try {
    const bookResult = await session.client.query(`
      INSERT INTO books (
        title, description, publication_date, cover_image, original_country, page,
        language_id, publication_house_id, average_rating, created_at, added_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,NOW(),$9)
      RETURNING id
    `, [title, description, publication_date, cover_image, original_country, page,
        language_id, publication_house_id, added_by]);

    const bookId = bookResult.rows[0].id;

    // Add book genres
    await session.client.query('INSERT INTO book_genres (book_id, genre_id) VALUES ($1, $2)', [bookId, genre_id]);

    // Add book authors
    for (const authorId of author_ids) {
      await session.client.query('INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)', [bookId, authorId]);
    }

    await session.client.query('COMMIT');
    session.client.release();
    activeSessions.delete(sessionId);
    
    res.status(201).json({ success: true, book_id: bookId });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ success: false, message: 'Error adding book' });
  }
});

module.exports = router;
