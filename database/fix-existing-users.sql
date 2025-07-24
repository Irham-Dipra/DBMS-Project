-- Fix existing users to be active by default
-- This script ensures all existing users are marked as active

-- Update all existing users to be active if they don't have a value set
UPDATE users 
SET is_active = TRUE 
WHERE is_active IS NULL OR is_active = FALSE;

-- Also clear any deactivation fields for existing users who shouldn't be deactivated
UPDATE users 
SET deactivation_reason = NULL,
    deactivated_by = NULL,
    deactivated_at = NULL,
    deactivation_duration_days = NULL,
    auto_reactivate_at = NULL
WHERE is_active = TRUE;

-- Verify the update
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_users,
    COUNT(CASE WHEN is_active = FALSE THEN 1 END) as deactivated_users
FROM users;