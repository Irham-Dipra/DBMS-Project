-- User Activation/Deactivation System Migration
-- This script adds columns and functionality for moderator user management

-- Add new columns to users table for activation/deactivation system
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
ADD COLUMN IF NOT EXISTS deactivated_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deactivation_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS auto_reactivate_at TIMESTAMP;

-- Create index for faster queries on active status
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_auto_reactivate ON users(auto_reactivate_at) WHERE auto_reactivate_at IS NOT NULL;

-- Create user_deactivation_history table to track all deactivation/reactivation events
CREATE TABLE IF NOT EXISTS user_deactivation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderator_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('deactivate', 'reactivate')),
    reason TEXT,
    duration_days INTEGER,
    auto_reactivate_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for deactivation history
CREATE INDEX IF NOT EXISTS idx_deactivation_history_user_id ON user_deactivation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_deactivation_history_moderator_id ON user_deactivation_history(moderator_id);
CREATE INDEX IF NOT EXISTS idx_deactivation_history_created_at ON user_deactivation_history(created_at);

-- Function to automatically reactivate users when their deactivation period expires
CREATE OR REPLACE FUNCTION auto_reactivate_users()
RETURNS INTEGER AS $$
DECLARE
    reactivated_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- Find users who should be automatically reactivated
    FOR user_record IN 
        SELECT id, username, auto_reactivate_at 
        FROM users 
        WHERE is_active = FALSE 
        AND auto_reactivate_at IS NOT NULL 
        AND auto_reactivate_at <= CURRENT_TIMESTAMP
    LOOP
        -- Reactivate the user
        UPDATE users 
        SET is_active = TRUE,
            deactivation_reason = NULL,
            deactivated_by = NULL,
            deactivated_at = NULL,
            deactivation_duration_days = NULL,
            auto_reactivate_at = NULL
        WHERE id = user_record.id;
        
        -- Log the automatic reactivation
        INSERT INTO user_deactivation_history (
            user_id, 
            moderator_id, 
            action, 
            reason
        ) VALUES (
            user_record.id,
            1, -- System user ID (should be created if doesn't exist)
            'reactivate',
            'Automatic reactivation after deactivation period expired'
        );
        
        reactivated_count := reactivated_count + 1;
        
        -- Log the reactivation
        RAISE NOTICE 'Auto-reactivated user ID: %, Username: %, Was scheduled for: %', 
            user_record.id, user_record.username, user_record.auto_reactivate_at;
    END LOOP;
    
    RETURN reactivated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a stored procedure for moderator to deactivate a user
CREATE OR REPLACE FUNCTION deactivate_user(
    p_user_id INTEGER,
    p_moderator_id INTEGER,
    p_reason TEXT,
    p_duration_days INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    auto_reactivate_date TIMESTAMP := NULL;
BEGIN
    -- Check if user exists and is currently active
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'User not found or already deactivated';
    END IF;
    
    -- Check if moderator exists and has permission (role = 'moderator')
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_moderator_id AND role = 'moderator') THEN
        RAISE EXCEPTION 'Moderator not found or insufficient permissions';
    END IF;
    
    -- Calculate auto reactivation date if duration is provided
    IF p_duration_days IS NOT NULL AND p_duration_days > 0 THEN
        auto_reactivate_date := CURRENT_TIMESTAMP + (p_duration_days || ' days')::INTERVAL;
    END IF;
    
    -- Deactivate the user
    UPDATE users 
    SET is_active = FALSE,
        deactivation_reason = p_reason,
        deactivated_by = p_moderator_id,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivation_duration_days = p_duration_days,
        auto_reactivate_at = auto_reactivate_date
    WHERE id = p_user_id;
    
    -- Log the deactivation
    INSERT INTO user_deactivation_history (
        user_id, 
        moderator_id, 
        action, 
        reason, 
        duration_days, 
        auto_reactivate_at
    ) VALUES (
        p_user_id,
        p_moderator_id,
        'deactivate',
        p_reason,
        p_duration_days,
        auto_reactivate_date
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a stored procedure for moderator to manually reactivate a user
CREATE OR REPLACE FUNCTION reactivate_user(
    p_user_id INTEGER,
    p_moderator_id INTEGER,
    p_reason TEXT DEFAULT 'Manual reactivation by moderator'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user exists and is currently deactivated
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_active = FALSE) THEN
        RAISE EXCEPTION 'User not found or already active';
    END IF;
    
    -- Check if moderator exists and has permission
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_moderator_id AND role = 'moderator') THEN
        RAISE EXCEPTION 'Moderator not found or insufficient permissions';
    END IF;
    
    -- Reactivate the user
    UPDATE users 
    SET is_active = TRUE,
        deactivation_reason = NULL,
        deactivated_by = NULL,
        deactivated_at = NULL,
        deactivation_duration_days = NULL,
        auto_reactivate_at = NULL
    WHERE id = p_user_id;
    
    -- Log the reactivation
    INSERT INTO user_deactivation_history (
        user_id, 
        moderator_id, 
        action, 
        reason
    ) VALUES (
        p_user_id,
        p_moderator_id,
        'reactivate',
        p_reason
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of user activation status with history
CREATE OR REPLACE VIEW user_activation_status AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active,
    u.deactivation_reason,
    u.deactivated_at,
    u.deactivation_duration_days,
    u.auto_reactivate_at,
    moderator.username as deactivated_by_username,
    CASE 
        WHEN u.is_active = FALSE AND u.auto_reactivate_at IS NOT NULL THEN
            CASE 
                WHEN u.auto_reactivate_at > CURRENT_TIMESTAMP THEN
                    EXTRACT(DAYS FROM (u.auto_reactivate_at - CURRENT_TIMESTAMP))::INTEGER
                ELSE 0
            END
        ELSE NULL
    END as days_until_reactivation,
    u.created_at as user_created_at
FROM users u
LEFT JOIN users moderator ON u.deactivated_by = moderator.id;

-- Insert system user for automatic operations if it doesn't exist
INSERT INTO users (id, username, email, password, role, first_name, last_name, is_active)
VALUES (1, 'system', 'system@litloom.com', 'system_password_hash', 'admin', 'System', 'User', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Update the sequence if system user was inserted
SELECT setval('users_id_seq', GREATEST(1, (SELECT MAX(id) FROM users)));

-- Create a cron-like function that should be called periodically to auto-reactivate users
-- This function should be called by the application server every hour or day
COMMENT ON FUNCTION auto_reactivate_users() IS 'Call this function periodically (hourly/daily) to automatically reactivate users whose deactivation period has expired';

-- Grant necessary permissions (adjust as needed based on your user roles)
-- GRANT EXECUTE ON FUNCTION deactivate_user(INTEGER, INTEGER, TEXT, INTEGER) TO moderator_role;
-- GRANT EXECUTE ON FUNCTION reactivate_user(INTEGER, INTEGER, TEXT) TO moderator_role;
-- GRANT SELECT ON user_activation_status TO moderator_role;