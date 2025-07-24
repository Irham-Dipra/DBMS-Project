-- Quick fix: Make sure all existing users are active by default
-- This should be the ONLY thing you need to run

-- Set all users as active (this is what should have happened automatically)
UPDATE users SET is_active = TRUE WHERE is_active IS NULL OR is_active = FALSE;

-- Clear any deactivation data for all users
UPDATE users SET 
    deactivation_reason = NULL,
    deactivated_by = NULL, 
    deactivated_at = NULL,
    deactivation_duration_days = NULL,
    auto_reactivate_at = NULL;

-- Check the result
SELECT username, is_active, role FROM users;