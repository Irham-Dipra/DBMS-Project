-- Book Deletion System with Full Data Tracking
-- This creates a comprehensive logging system for book deletions

-- 1. Create book deletion log table
CREATE TABLE book_deletion_log (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL,
    book_data JSONB NOT NULL,
    reviews_data JSONB,
    comments_data JSONB,
    ratings_data JSONB,
    user_books_data JSONB,
    deletion_reason TEXT,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id),
    total_reviews INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    total_user_books INTEGER DEFAULT 0
);

-- 2. Add deleted book tracking columns to user data tables
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS deleted_book_title VARCHAR(255);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_book_title VARCHAR(255);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS deleted_book_title VARCHAR(255);

-- 3. Modify foreign key constraints to preserve user data
-- Remove CASCADE DELETE from user-generated content tables

-- Drop existing foreign key constraints
ALTER TABLE user_books DROP CONSTRAINT IF EXISTS user_books_book_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_book_id_fkey;
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_book_id_fkey;

-- Add new constraints with SET NULL instead of CASCADE
ALTER TABLE user_books ADD CONSTRAINT user_books_book_id_fkey 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE reviews ADD CONSTRAINT reviews_book_id_fkey 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE ratings ADD CONSTRAINT ratings_book_id_fkey 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;

-- 4. Create comprehensive book deletion trigger
CREATE OR REPLACE FUNCTION track_book_deletion() RETURNS TRIGGER AS $$
DECLARE
    reviews_json JSONB;
    comments_json JSONB;
    ratings_json JSONB;
    user_books_json JSONB;
    review_count INTEGER;
    comment_count INTEGER;
    rating_count INTEGER;
    user_book_count INTEGER;
BEGIN
    -- Collect all review data for this book
    SELECT 
        COALESCE(json_agg(reviews.*), '[]'::json)::jsonb,
        COUNT(*)
    INTO reviews_json, review_count
    FROM reviews 
    WHERE book_id = OLD.id;
    
    -- Collect all comment data for reviews of this book
    SELECT 
        COALESCE(json_agg(c.*), '[]'::json)::jsonb,
        COUNT(*)
    INTO comments_json, comment_count
    FROM comments c
    JOIN reviews r ON c.review_id = r.id
    WHERE r.book_id = OLD.id;
    
    -- Collect all rating data for this book
    SELECT 
        COALESCE(json_agg(ratings.*), '[]'::json)::jsonb,
        COUNT(*)
    INTO ratings_json, rating_count
    FROM ratings 
    WHERE book_id = OLD.id;
    
    -- Collect all user_books data for this book
    SELECT 
        COALESCE(json_agg(user_books.*), '[]'::json)::jsonb,
        COUNT(*)
    INTO user_books_json, user_book_count
    FROM user_books 
    WHERE book_id = OLD.id;
    
    -- Log everything to deletion log
    INSERT INTO book_deletion_log (
        book_id, book_data, reviews_data, comments_data, ratings_data, user_books_data,
        deletion_reason, total_reviews, total_comments, total_ratings, total_user_books
    ) VALUES (
        OLD.id, 
        to_jsonb(OLD.*), 
        reviews_json, 
        comments_json, 
        ratings_json, 
        user_books_json,
        'Book deleted by moderator',
        review_count,
        comment_count,
        rating_count,
        user_book_count
    );
    
    -- Update user data with deleted book title before foreign key is set to NULL
    UPDATE user_books 
    SET deleted_book_title = OLD.title 
    WHERE book_id = OLD.id;
    
    UPDATE reviews 
    SET deleted_book_title = OLD.title 
    WHERE book_id = OLD.id;
    
    UPDATE ratings 
    SET deleted_book_title = OLD.title 
    WHERE book_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS book_deletion_trigger ON books;
CREATE TRIGGER book_deletion_trigger
    BEFORE DELETE ON books
    FOR EACH ROW
    EXECUTE FUNCTION track_book_deletion();

-- 6. Create indexes for better performance
CREATE INDEX idx_book_deletion_log_book_id ON book_deletion_log(book_id);
CREATE INDEX idx_book_deletion_log_deleted_at ON book_deletion_log(deleted_at);
CREATE INDEX idx_user_books_deleted_title ON user_books(deleted_book_title) WHERE deleted_book_title IS NOT NULL;
CREATE INDEX idx_reviews_deleted_title ON reviews(deleted_book_title) WHERE deleted_book_title IS NOT NULL;
CREATE INDEX idx_ratings_deleted_title ON ratings(deleted_book_title) WHERE deleted_book_title IS NOT NULL;

-- 7. Create function to get deletion statistics
CREATE OR REPLACE FUNCTION get_book_deletion_stats()
RETURNS TABLE (
    total_deleted_books INTEGER,
    total_preserved_reviews INTEGER,
    total_preserved_comments INTEGER,
    total_preserved_ratings INTEGER,
    total_preserved_user_books INTEGER,
    last_deletion_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deleted_books,
        SUM(bdl.total_reviews)::INTEGER as total_preserved_reviews,
        SUM(bdl.total_comments)::INTEGER as total_preserved_comments,
        SUM(bdl.total_ratings)::INTEGER as total_preserved_ratings,
        SUM(bdl.total_user_books)::INTEGER as total_preserved_user_books,
        MAX(bdl.deleted_at) as last_deletion_date
    FROM book_deletion_log bdl;
END;
$$ LANGUAGE plpgsql;