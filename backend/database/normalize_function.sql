-- Function to normalize search terms (remove spaces, punctuation, lowercase)
CREATE OR REPLACE FUNCTION normalize_search_term(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(REGEXP_REPLACE(input_text, '[^a-zA-Z0-9]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;