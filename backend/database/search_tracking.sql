-- Smart Search Tracking Tables for Content Gap Analysis
-- This tracks all searches with intelligent normalization to catch typos and variations

-- Main search tracking table
CREATE TABLE search_queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT, -- Original search text as typed by user
    normalized_query TEXT, -- Cleaned version: lowercase, no spaces/punctuation
    search_type VARCHAR(50) NOT NULL, -- 'text_search', 'filtered_search', 'author_search'
    search_filters JSONB, -- Store filter parameters for filtered searches
    result_count INTEGER DEFAULT 0,
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Failed search tracking (searches that returned 0 results)
CREATE TABLE failed_searches (
    id SERIAL PRIMARY KEY,
    search_query_id INTEGER REFERENCES search_queries(id),
    search_category VARCHAR(50), -- 'books', 'authors', 'genres', 'languages', 'publishers'
    missing_term TEXT, -- Original search term as typed
    normalized_term TEXT, -- Cleaned version for grouping similar searches
    search_context JSONB, -- Additional context about the search
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content gap analysis with smart grouping
CREATE VIEW content_gaps AS
SELECT 
    'authors' as content_type,
    normalized_term as normalized_search,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as search_count,
    COUNT(DISTINCT sq.user_id) as user_count,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'authors'
GROUP BY normalized_term

UNION ALL

SELECT 
    'books' as content_type,
    normalized_term as normalized_search,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as search_count,
    COUNT(DISTINCT sq.user_id) as user_count,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'books'
GROUP BY normalized_term

UNION ALL

SELECT 
    'genres' as content_type,
    normalized_term as normalized_search,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as search_count,
    COUNT(DISTINCT sq.user_id) as user_count,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'genres'
GROUP BY normalized_term

UNION ALL

SELECT 
    'languages' as content_type,
    normalized_term as normalized_search,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as search_count,
    COUNT(DISTINCT sq.user_id) as user_count,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'languages'
GROUP BY normalized_term

UNION ALL

SELECT 
    'publishers' as content_type,
    normalized_term as normalized_search,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as search_count,
    COUNT(DISTINCT sq.user_id) as user_count,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'publishers'
GROUP BY normalized_term

ORDER BY search_count DESC, normalized_search ASC;

-- Function to normalize search terms (remove spaces, punctuation, lowercase)
CREATE OR REPLACE FUNCTION normalize_search_term(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(REGEXP_REPLACE(input_text, '[^a-zA-Z0-9]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Top missing authors with smart grouping
CREATE VIEW missing_authors_analysis AS
SELECT 
    normalized_term as normalized_author,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as total_searches,
    COUNT(DISTINCT sq.user_id) as unique_users,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'authors'
GROUP BY normalized_term
ORDER BY total_searches DESC, normalized_author ASC;

-- Top missing books with smart grouping
CREATE VIEW missing_books_analysis AS
SELECT 
    normalized_term as normalized_book,
    array_agg(DISTINCT missing_term ORDER BY missing_term) as search_variations,
    COUNT(*) as total_searches,
    COUNT(DISTINCT sq.user_id) as unique_users,
    MIN(fs.created_at) as first_searched,
    MAX(fs.created_at) as last_searched
FROM failed_searches fs
JOIN search_queries sq ON fs.search_query_id = sq.id
WHERE fs.search_category = 'books'
GROUP BY normalized_term
ORDER BY total_searches DESC, normalized_book ASC;

-- Indexes for performance
CREATE INDEX idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX idx_search_queries_timestamp ON search_queries(search_timestamp);
CREATE INDEX idx_search_queries_result_count ON search_queries(result_count);
CREATE INDEX idx_search_queries_normalized ON search_queries(normalized_query);
CREATE INDEX idx_failed_searches_category ON failed_searches(search_category);
CREATE INDEX idx_failed_searches_normalized ON failed_searches(normalized_term);
CREATE INDEX idx_failed_searches_timestamp ON failed_searches(created_at);