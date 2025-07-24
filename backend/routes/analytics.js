const express = require('express');
const pool = require('../db');
const router = express.Router();

// Middleware to verify JWT token (reuse from auth.js)
const verifyToken = require('./auth').verifyToken || (async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid token' });
  }
});

// Genre-wise ratings analytics with enhanced metrics
router.get('/genre-ratings', verifyToken, async (req, res) => {
  console.log('Genre ratings request received with params:', req.query);
  try {
    const { startDate, endDate, displayType = 'top-rated', minBooks = 0, minRating = 0, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        g.name,
        ROUND(AVG(COALESCE(r.value, b.average_rating)), 2) as avgRating,
        COUNT(DISTINCT b.id) as totalBooks,
        COUNT(r.value) as totalRatings,
        COUNT(DISTINCT rev.id) as reviewCount,
        COUNT(DISTINCT c.id) as commentCount,
        COALESCE(SUM(rev.upvotes), 0) as upvotes,
        COALESCE(SUM(rev.downvotes), 0) as downvotes
      FROM genres g
      LEFT JOIN book_genres bg ON g.id = bg.genre_id
      LEFT JOIN books b ON bg.book_id = b.id
      LEFT JOIN ratings r ON b.id = r.book_id
      LEFT JOIN reviews rev ON b.id = rev.book_id
      LEFT JOIN comments c ON rev.id = c.review_id
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Add date range filtering
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(`b.created_at >= $${++paramCount}`);
      params.push(startDate);
    }
    if (endDate) {
      dateConditions.push(`b.created_at <= $${++paramCount}`);
      params.push(endDate);
    }
    
    if (dateConditions.length > 0) {
      query += ` WHERE ${dateConditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY g.id, g.name`;
    
    // Add filtering conditions
    const havingConditions = [];
    havingConditions.push('COUNT(DISTINCT b.id) > 0');
    
    if (minBooks > 0) {
      havingConditions.push(`COUNT(DISTINCT b.id) >= $${++paramCount}`);
      params.push(parseInt(minBooks));
    }
    
    if (minRating > 0) {
      havingConditions.push(`AVG(COALESCE(r.value, b.average_rating)) >= $${++paramCount}`);
      params.push(parseFloat(minRating));
    }
    
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }
    
    // Add ordering based on display type
    switch (displayType) {
      case 'top-rated':
        query += ` ORDER BY avgRating DESC, totalBooks DESC`;
        break;
      case 'lowest-rated':
        query += ` ORDER BY avgRating ASC, totalBooks DESC`;
        break;
      case 'most-books':
        query += ` ORDER BY totalBooks DESC, avgRating DESC`;
        break;
      case 'least-books':
        query += ` ORDER BY totalBooks ASC, avgRating DESC`;
        break;
      case 'most-engaging':
        query += ` ORDER BY (COUNT(DISTINCT rev.id) * 5 + COUNT(DISTINCT c.id) * 3 + (COALESCE(SUM(rev.upvotes), 0) + COALESCE(SUM(rev.downvotes), 0)) * 1) DESC, avgRating DESC`;
        break;
      default:
        query += ` ORDER BY avgRating DESC`;
    }
    
    // Add limit
    if (limit && limit !== 'all') {
      query += ` LIMIT $${++paramCount}`;
      params.push(parseInt(limit));
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        name: row.name,
        avgRating: parseFloat(row.avgrating) || 0,
        totalBooks: parseInt(row.totalbooks) || 0,
        totalRatings: parseInt(row.totalratings) || 0,
        reviewCount: parseInt(row.reviewcount) || 0,
        commentCount: parseInt(row.commentcount) || 0,
        upvotes: parseInt(row.upvotes) || 0,
        downvotes: parseInt(row.downvotes) || 0
      }))
    });
  } catch (error) {
    console.error('Genre ratings error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching genre ratings' });
  }
});

// Author ratings analytics with enhanced metrics
router.get('/author-ratings', verifyToken, async (req, res) => {
  console.log('Author ratings request received with params:', req.query);
  try {
    const { startDate, endDate, authorId, displayType = 'top-rated', minBooks = 0, minRating = 0, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        a.id,
        a.name,
        ROUND(AVG(COALESCE(r.value, b.average_rating)), 2) as avgRating,
        COUNT(DISTINCT b.id) as totalBooks,
        COUNT(r.value) as totalRatings,
        COUNT(DISTINCT rev.id) as reviewCount,
        COUNT(DISTINCT c.id) as commentCount,
        COALESCE(SUM(rev.upvotes), 0) as upvotes,
        COALESCE(SUM(rev.downvotes), 0) as downvotes
      FROM authors a
      LEFT JOIN book_authors ba ON a.id = ba.author_id
      LEFT JOIN books b ON ba.book_id = b.id
      LEFT JOIN ratings r ON b.id = r.book_id
      LEFT JOIN reviews rev ON b.id = rev.book_id
      LEFT JOIN comments c ON rev.id = c.review_id
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Add date range and author filtering
    const conditions = [];
    if (startDate) {
      conditions.push(`b.created_at >= $${++paramCount}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`b.created_at <= $${++paramCount}`);
      params.push(endDate);
    }
    if (authorId) {
      conditions.push(`a.id = $${++paramCount}`);
      params.push(authorId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY a.id, a.name`;
    
    // Add filtering conditions
    const havingConditions = [];
    havingConditions.push('COUNT(DISTINCT b.id) > 0');
    
    if (minBooks > 0) {
      havingConditions.push(`COUNT(DISTINCT b.id) >= $${++paramCount}`);
      params.push(parseInt(minBooks));
    }
    
    if (minRating > 0) {
      havingConditions.push(`AVG(COALESCE(r.value, b.average_rating)) >= $${++paramCount}`);
      params.push(parseFloat(minRating));
    }
    
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }
    
    // Add ordering based on display type
    switch (displayType) {
      case 'top-rated':
        query += ` ORDER BY avgRating DESC, totalBooks DESC`;
        break;
      case 'lowest-rated':
        query += ` ORDER BY avgRating ASC, totalBooks DESC`;
        break;
      case 'most-books':
        query += ` ORDER BY totalBooks DESC, avgRating DESC`;
        break;
      case 'least-books':
        query += ` ORDER BY totalBooks ASC, avgRating DESC`;
        break;
      default:
        query += ` ORDER BY avgRating DESC`;
    }
    
    // Add limit
    if (limit && limit !== 'all') {
      query += ` LIMIT $${++paramCount}`;
      params.push(parseInt(limit));
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        avgRating: parseFloat(row.avgrating) || 0,
        totalBooks: parseInt(row.totalbooks) || 0,
        totalRatings: parseInt(row.totalratings) || 0,
        reviewCount: parseInt(row.reviewcount) || 0,
        commentCount: parseInt(row.commentcount) || 0,
        upvotes: parseInt(row.upvotes) || 0,
        downvotes: parseInt(row.downvotes) || 0
      }))
    });
  } catch (error) {
    console.error('Author ratings error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching author ratings' });
  }
});

// Publisher ratings analytics with enhanced metrics
router.get('/publisher-ratings', verifyToken, async (req, res) => {
  console.log('Publisher ratings request received with params:', req.query);
  try {
    const { startDate, endDate, publisherId, displayType = 'top-rated', minBooks = 0, minRating = 0, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        ph.id,
        ph.name,
        ROUND(AVG(COALESCE(r.value, b.average_rating)), 2) as avgRating,
        COUNT(DISTINCT b.id) as totalBooks,
        COUNT(r.value) as totalRatings,
        COUNT(DISTINCT rev.id) as reviewCount,
        COUNT(DISTINCT c.id) as commentCount,
        COALESCE(SUM(rev.upvotes), 0) as upvotes,
        COALESCE(SUM(rev.downvotes), 0) as downvotes
      FROM publication_houses ph
      LEFT JOIN books b ON ph.id = b.publication_house_id
      LEFT JOIN ratings r ON b.id = r.book_id
      LEFT JOIN reviews rev ON b.id = rev.book_id
      LEFT JOIN comments c ON rev.id = c.review_id
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Add date range and publisher filtering
    const conditions = [];
    if (startDate) {
      conditions.push(`b.created_at >= $${++paramCount}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`b.created_at <= $${++paramCount}`);
      params.push(endDate);
    }
    if (publisherId) {
      conditions.push(`ph.id = $${++paramCount}`);
      params.push(publisherId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY ph.id, ph.name`;
    
    // Add filtering conditions
    const havingConditions = [];
    havingConditions.push('COUNT(DISTINCT b.id) > 0');
    
    if (minBooks > 0) {
      havingConditions.push(`COUNT(DISTINCT b.id) >= $${++paramCount}`);
      params.push(parseInt(minBooks));
    }
    
    if (minRating > 0) {
      havingConditions.push(`AVG(COALESCE(r.value, b.average_rating)) >= $${++paramCount}`);
      params.push(parseFloat(minRating));
    }
    
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }
    
    // Add ordering based on display type
    switch (displayType) {
      case 'top-rated':
        query += ` ORDER BY avgRating DESC, totalBooks DESC`;
        break;
      case 'lowest-rated':
        query += ` ORDER BY avgRating ASC, totalBooks DESC`;
        break;
      case 'most-books':
        query += ` ORDER BY totalBooks DESC, avgRating DESC`;
        break;
      case 'least-books':
        query += ` ORDER BY totalBooks ASC, avgRating DESC`;
        break;
      default:
        query += ` ORDER BY avgRating DESC`;
    }
    
    // Add limit
    if (limit && limit !== 'all') {
      query += ` LIMIT $${++paramCount}`;
      params.push(parseInt(limit));
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        avgRating: parseFloat(row.avgrating) || 0,
        totalBooks: parseInt(row.totalbooks) || 0,
        totalRatings: parseInt(row.totalratings) || 0,
        reviewCount: parseInt(row.reviewcount) || 0,
        commentCount: parseInt(row.commentcount) || 0,
        upvotes: parseInt(row.upvotes) || 0,
        downvotes: parseInt(row.downvotes) || 0
      }))
    });
  } catch (error) {
    console.error('Publisher ratings error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching publisher ratings' });
  }
});

// Content Gap Analysis - What users search for but can't find
router.get('/content-gaps', async (req, res) => {
  console.log('Content gaps request received with params:', req.query);
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        content_type,
        normalized_search,
        search_variations,
        search_count,
        user_count,
        first_searched,
        last_searched
      FROM content_gaps
    `;
    
    const params = [];
    let paramCount = 0;
    const conditions = [];
    
    // Filter by date range if specified
    if (startDate) {
      conditions.push(`first_searched >= $${++paramCount}`);
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push(`last_searched <= $${++paramCount}`);
      params.push(endDate);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += `
      ORDER BY search_count DESC, normalized_search ASC
      LIMIT $${++paramCount}
    `;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    console.log('Content gaps result:', result.rows);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        contentType: row.content_type,
        normalizedSearch: row.normalized_search,
        searchVariations: row.search_variations,
        searchCount: parseInt(row.search_count),
        userCount: parseInt(row.user_count),
        firstSearched: row.first_searched,
        lastSearched: row.last_searched
      }))
    });
  } catch (error) {
    console.error('Content gaps error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching content gaps' });
  }
});

// Get available options for dropdowns
router.get('/options', verifyToken, async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = '';
    let dataKey = '';
    
    switch (type) {
      case 'books':
        query = `
          SELECT id, title as name 
          FROM books 
          ORDER BY title 
          LIMIT 100
        `;
        dataKey = 'books';
        break;
      case 'authors':
        query = `
          SELECT id, name 
          FROM authors 
          ORDER BY name 
          LIMIT 100
        `;
        dataKey = 'authors';
        break;
      case 'publishers':
        query = `
          SELECT id, name 
          FROM publication_houses 
          ORDER BY name 
          LIMIT 100
        `;
        dataKey = 'publishers';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid type parameter' });
    }
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      [dataKey]: result.rows
    });
  } catch (error) {
    console.error('Options fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching options' });
  }
});

// Get comprehensive analytics summary
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    let paramCount = 0;
    
    const dateConditions = [];
    
    if (startDate) {
      dateConditions.push(`b.created_at >= $${++paramCount}`);
      params.push(startDate);
    }
    
    if (endDate) {
      dateConditions.push(`b.created_at <= $${++paramCount}`);
      params.push(endDate);
    }
    
    if (dateConditions.length > 0) {
      dateFilter = `WHERE ${dateConditions.join(' AND ')}`;
    }
    
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT b.id) as totalBooks,
        COUNT(DISTINCT a.id) as totalAuthors,
        COUNT(DISTINCT g.id) as totalGenres,
        COUNT(DISTINCT ph.id) as totalPublishers,
        COUNT(r.id) as totalRatings,
        ROUND(AVG(r.value), 2) as overallAvgRating
      FROM books b
      LEFT JOIN book_authors ba ON b.id = ba.book_id
      LEFT JOIN authors a ON ba.author_id = a.id
      LEFT JOIN book_genres bg ON b.id = bg.book_id
      LEFT JOIN genres g ON bg.genre_id = g.id
      LEFT JOIN publication_houses ph ON b.publication_house_id = ph.id
      LEFT JOIN ratings r ON b.id = r.book_id
      ${dateFilter}
    `;
    
    const result = await pool.query(summaryQuery, params);
    
    res.json({
      success: true,
      summary: {
        totalBooks: parseInt(result.rows[0].totalbooks) || 0,
        totalAuthors: parseInt(result.rows[0].totalauthors) || 0,
        totalGenres: parseInt(result.rows[0].totalgenres) || 0,
        totalPublishers: parseInt(result.rows[0].totalpublishers) || 0,
        totalRatings: parseInt(result.rows[0].totalratings) || 0,
        overallAvgRating: parseFloat(result.rows[0].overallavgrating) || 0
      }
    });
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching summary' });
  }
});

// Get trending books/genres over time
router.get('/trends', verifyToken, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    let query = '';
    const params = [];
    let paramCount = 0;
    
    const dateConditions = [];
    
    if (startDate) {
      dateConditions.push(`r.created_at >= $${++paramCount}`);
      params.push(startDate);
    }
    
    if (endDate) {
      dateConditions.push(`r.created_at <= $${++paramCount}`);
      params.push(endDate);
    }
    
    const dateFilter = dateConditions.length > 0 ? ` WHERE ${dateConditions.join(' AND ')}` : '';
    
    if (type === 'genres') {
      query = `
        SELECT 
          g.name,
          TO_CHAR(r.created_at, 'YYYY-MM') as month,
          COUNT(r.value) as popularity,
          ROUND(AVG(r.value), 2) as avgRating
        FROM genres g
        JOIN book_genres bg ON g.id = bg.genre_id
        JOIN books b ON bg.book_id = b.id
        JOIN ratings r ON b.id = r.book_id
        ${dateFilter}
        GROUP BY g.name, TO_CHAR(r.created_at, 'YYYY-MM')
        ORDER BY month DESC, popularity DESC
        LIMIT 50
      `;
    } else {
      query = `
        SELECT 
          b.title as name,
          TO_CHAR(r.created_at, 'YYYY-MM') as month,
          COUNT(r.value) as popularity,
          ROUND(AVG(r.value), 2) as avgRating
        FROM books b
        JOIN ratings r ON b.id = r.book_id
        ${dateFilter}
        GROUP BY b.title, TO_CHAR(r.created_at, 'YYYY-MM')
        ORDER BY month DESC, popularity DESC
        LIMIT 50
      `;
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      trends: result.rows.map(row => ({
        name: row.name,
        month: row.month,
        popularity: parseInt(row.popularity) || 0,
        avgRating: parseFloat(row.avgrating) || 0
      }))
    });
  } catch (error) {
    console.error('Trends fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching trends' });
  }
});

// User Active Time Insights - hourly activity analysis
router.get('/user-activity-time', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        EXTRACT(HOUR FROM login_time) as hour,
        COUNT(*) as login_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM login_history
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Add date range filtering
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(`login_time >= $${++paramCount}`);
      params.push(startDate);
    }
    if (endDate) {
      dateConditions.push(`login_time <= $${++paramCount}`);
      params.push(endDate);
    }
    
    if (dateConditions.length > 0) {
      query += ` WHERE ${dateConditions.join(' AND ')}`;
    }
    
    query += `
      GROUP BY EXTRACT(HOUR FROM login_time)
      ORDER BY hour
    `;
    
    const result = await pool.query(query, params);
    
    // Fill in missing hours with 0 activity
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
      hour: hour,
      login_count: 0,
      unique_users: 0
    }));
    
    result.rows.forEach(row => {
      const hour = parseInt(row.hour);
      hourlyActivity[hour] = {
        hour: hour,
        login_count: parseInt(row.login_count),
        unique_users: parseInt(row.unique_users)
      };
    });
    
    res.json({
      success: true,
      data: hourlyActivity
    });
  } catch (error) {
    console.error('User activity time error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user activity time' });
  }
});

// User Engagement & Ranking System
router.get('/user-engagement', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20, userId } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        u.is_active,
        COALESCE(review_count, 0) as reviews,
        COALESCE(comment_count, 0) as comments,
        COALESCE(vote_count, 0) as votes,
        (
          COALESCE(review_count, 0) * 5 + 
          COALESCE(comment_count, 0) * 3 + 
          COALESCE(vote_count, 0) * 1
        ) as engagement_score
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as review_count
        FROM reviews
        GROUP BY user_id
      ) r ON u.id = r.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as comment_count
        FROM comments
        GROUP BY user_id
      ) c ON u.id = c.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as vote_count
        FROM votes
        GROUP BY user_id
      ) v ON u.id = v.user_id
    `;
    
    const params = [];
    
    if (userId) {
      query += ' WHERE u.id = $1';
      params.push(userId);
    }
    
    query += `
      ORDER BY engagement_score DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        created_at: row.created_at,
        active_status: row.is_active,
        reviews: parseInt(row.reviews),
        comments: parseInt(row.comments),
        votes: parseInt(row.votes),
        engagement_score: parseInt(row.engagement_score)
      }))
    });
  } catch (error) {
    console.error('User engagement error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user engagement' });
  }
});

// User Base Overview
router.get('/user-base-overview', verifyToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
      FROM users
    `;
    
    const summaryResult = await pool.query(summaryQuery);
    
    // Get detailed user list with last login info
    let detailQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at,
        u.is_active,
        u.deactivation_reason,
        u.deactivated_at,
        u.deactivation_duration_days,
        u.auto_reactivate_at,
        CASE 
          WHEN u.is_active = FALSE AND u.auto_reactivate_at IS NOT NULL THEN
            CASE 
              WHEN u.auto_reactivate_at > CURRENT_TIMESTAMP THEN
                EXTRACT(DAYS FROM (u.auto_reactivate_at - CURRENT_TIMESTAMP))::INTEGER
              ELSE 0
            END
          ELSE NULL
        END as days_until_reactivation,
        lh.last_login,
        lh.login_count
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          MAX(login_time) as last_login,
          COUNT(*) as login_count
        FROM login_history
        GROUP BY user_id
      ) lh ON u.id = lh.user_id
    `;
    
    const params = [];
    
    if (status) {
      if (status === 'active') {
        detailQuery += ' WHERE u.is_active = true';
      } else if (status === 'inactive') {
        detailQuery += ' WHERE u.is_active = false';
      } else if (status === 'new') {
        detailQuery += ' WHERE u.created_at >= NOW() - INTERVAL \'7 days\'';
      }
    }
    
    detailQuery += `
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    
    const detailResult = await pool.query(detailQuery, params);
    
    res.json({
      success: true,
      summary: {
        total_users: parseInt(summaryResult.rows[0].total_users),
        active_users: parseInt(summaryResult.rows[0].active_users),
        inactive_users: parseInt(summaryResult.rows[0].inactive_users),
        new_users_week: parseInt(summaryResult.rows[0].new_users_week),
        new_users_month: parseInt(summaryResult.rows[0].new_users_month)
      },
      users: detailResult.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        created_at: row.created_at,
        active_status: row.is_active,
        deactivation_reason: row.deactivation_reason,
        deactivated_at: row.deactivated_at,
        deactivation_duration_days: row.deactivation_duration_days,
        auto_reactivate_at: row.auto_reactivate_at,
        days_until_reactivation: row.days_until_reactivation,
        last_login: row.last_login,
        login_count: parseInt(row.login_count) || 0
      }))
    });
  } catch (error) {
    console.error('User base overview error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user base overview' });
  }
});

// Detailed User Activity Profile
router.get('/user-activity-profile/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user basic info
    const userQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at,
        u.is_active,
        u.bio,
        u.profile_picture_url
      FROM users u
      WHERE u.id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get detailed activity stats
    const activityQuery = `
      SELECT 
        'reviews' as activity_type,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM reviews WHERE user_id = $1
      UNION ALL
      SELECT 
        'comments' as activity_type,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM comments WHERE user_id = $1
      UNION ALL
      SELECT 
        'votes' as activity_type,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM votes WHERE user_id = $1
      UNION ALL
      SELECT 
        'books_added' as activity_type,
        COUNT(*) as count,
        MAX(date_added) as last_activity
      FROM user_books WHERE user_id = $1
    `;
    
    const activityResult = await pool.query(activityQuery, [userId]);
    
    // Get recent reviews
    const recentReviewsQuery = `
      SELECT 
        r.id,
        r.title,
        r.body,
        r.rating,
        r.created_at,
        b.title as book_title,
        b.id as book_id
      FROM reviews r
      JOIN books b ON r.book_id = b.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `;
    
    const recentReviewsResult = await pool.query(recentReviewsQuery, [userId]);
    
    // Get login history
    const loginHistoryQuery = `
      SELECT 
        login_time,
        logout_time,
        ip_address
      FROM login_history
      WHERE user_id = $1
      ORDER BY login_time DESC
      LIMIT 10
    `;
    
    const loginHistoryResult = await pool.query(loginHistoryQuery, [userId]);
    
    // Calculate engagement score
    const engagement = activityResult.rows.reduce((acc, row) => {
      acc[row.activity_type] = {
        count: parseInt(row.count),
        last_activity: row.last_activity
      };
      return acc;
    }, {});
    
    const engagementScore = 
      (engagement.reviews?.count || 0) * 5 +
      (engagement.comments?.count || 0) * 3 +
      (engagement.votes?.count || 0) * 1;
    
    res.json({
      success: true,
      user: userResult.rows[0],
      engagement: {
        score: engagementScore,
        activities: engagement
      },
      recent_reviews: recentReviewsResult.rows,
      login_history: loginHistoryResult.rows
    });
  } catch (error) {
    console.error('User activity profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user activity profile' });
  }
});

module.exports = router;