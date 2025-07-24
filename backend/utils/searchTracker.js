const pool = require('../db');

// Function to normalize search terms for smart grouping
function normalizeSearchTerm(text) {
  if (!text) return '';
  // Remove all non-alphanumeric characters and convert to lowercase
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Function to extract user ID from request (if authenticated)
function extractUserId(req) {
  try {
    return req.user?.id || null;
  } catch (error) {
    return null;
  }
}

// Function to get client IP address
function getClientIP(req) {
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

// Log search query to database
async function logSearchQuery(req, searchType, queryText, filters, resultCount) {
  try {
    const userId = extractUserId(req);
    const normalizedQuery = normalizeSearchTerm(queryText);
    const ipAddress = getClientIP(req);
    const userAgent = req.get('User-Agent');

    const query = `
      INSERT INTO search_queries (
        user_id, query_text, normalized_query, search_type, 
        search_filters, result_count, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const params = [
      userId,
      queryText,
      normalizedQuery,
      searchType,
      filters ? JSON.stringify(filters) : null,
      resultCount,
      ipAddress,
      userAgent
    ];

    const result = await pool.query(query, params);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging search query:', error);
    return null;
  }
}

// Log failed search to database
async function logFailedSearch(searchQueryId, category, searchTerm) {
  try {
    if (!searchQueryId || !searchTerm) return;

    const normalizedTerm = normalizeSearchTerm(searchTerm);

    const query = `
      INSERT INTO failed_searches (
        search_query_id, search_category, missing_term, normalized_term
      ) VALUES ($1, $2, $3, $4)
    `;

    const params = [searchQueryId, category, searchTerm, normalizedTerm];
    await pool.query(query, params);
  } catch (error) {
    console.error('Error logging failed search:', error);
  }
}

// Main search tracking middleware
async function trackSearch(req, searchType, queryText, filters, data) {
  try {
    // Calculate total result count
    const resultCount = Object.values(data).reduce((total, categoryResults) => {
      return total + (Array.isArray(categoryResults) ? categoryResults.length : 0);
    }, 0);

    // Log the search query
    const searchQueryId = await logSearchQuery(req, searchType, queryText, filters, resultCount);

    // If no results found, log failed searches
    if (resultCount === 0 && searchQueryId) {
      // Just log it as a general search failure, no category guessing
      await logFailedSearch(searchQueryId, 'general', queryText);
    }

    return searchQueryId;
  } catch (error) {
    console.error('Error in search tracking:', error);
    return null;
  }
}

// Track specific search failures for individual searches
async function trackSpecificFailure(req, category, searchTerm) {
  try {
    const userId = extractUserId(req);
    const normalizedQuery = normalizeSearchTerm(searchTerm);
    const ipAddress = getClientIP(req);
    const userAgent = req.get('User-Agent');

    // First log the search query
    const searchQueryId = await logSearchQuery(
      req, 
      `${category}_search`, 
      searchTerm, 
      null, 
      0
    );

    // Then log the failure
    if (searchQueryId) {
      await logFailedSearch(searchQueryId, category, searchTerm);
    }

    return searchQueryId;
  } catch (error) {
    console.error('Error tracking specific failure:', error);
    return null;
  }
}

module.exports = {
  trackSearch,
  trackSpecificFailure,
  normalizeSearchTerm,
  logSearchQuery,
  logFailedSearch
};