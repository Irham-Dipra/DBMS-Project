-- Setup moderator role for testing
-- Replace 'your_username' with your actual username

-- First, let's see what users exist and their current roles
SELECT id, username, email, role FROM users ORDER BY id;

-- Update a specific user to be a moderator (replace 'your_username' with your actual username)
-- UPDATE users SET role = 'moderator' WHERE username = 'your_username';

-- Alternative: Update user by email (replace with your email)
-- UPDATE users SET role = 'moderator' WHERE email = 'your_email@example.com';

-- Alternative: Update the first user to be a moderator
-- UPDATE users SET role = 'moderator' WHERE id = (SELECT MIN(id) FROM users);

-- Verify the change
-- SELECT id, username, email, role FROM users WHERE role = 'moderator';