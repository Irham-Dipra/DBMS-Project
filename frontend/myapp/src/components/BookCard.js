import React, { useState } from 'react';
import './BookCard.css';
import { useNavigate } from 'react-router-dom';
import { FaStar, FaPlus, FaCheck } from 'react-icons/fa';

const BookCard = ({
  id,
  title = 'Sample Book Title',
  author = 'Author Name',
  averageRating = 4.5,
  coverUrl = '',
}) => {
  const navigate = useNavigate();
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);

  // Check if user is logged in (you might need to adjust this based on your auth implementation)
  const isLoggedIn = () => {
    console.log('=== CHECKING LOGIN STATUS ===');
    console.log('All localStorage contents:', { ...localStorage });
    
    // Check for common auth token keys
    const tokenKeys = ['authToken', 'token', 'accessToken', 'jwt', 'authJWT', 'Bearer'];
    let hasToken = false;
    let foundToken = null;
    
    for (const key of tokenKeys) {
      const token = localStorage.getItem(key);
      if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
        console.log(`✅ Found valid auth token with key: ${key}, value: ${token.substring(0, 20)}...`);
        hasToken = true;
        foundToken = token;
        break;
      } else if (token) {
        console.log(`❌ Found invalid/empty token with key: ${key}, value: ${token}`);
      }
    }
    
    // Check for user data
    const userDataKeys = ['user', 'userData', 'currentUser', 'authUser', 'loggedInUser', 'userInfo'];
    let hasUserData = false;
    let foundUserData = null;
    
    for (const key of userDataKeys) {
      const userData = localStorage.getItem(key);
      if (userData && userData.trim() !== '' && userData !== 'null' && userData !== 'undefined') {
        try {
          const parsed = JSON.parse(userData);
          if (parsed && typeof parsed === 'object') {
            console.log(`✅ Found valid user data with key: ${key}`, parsed);
            hasUserData = true;
            foundUserData = parsed;
            break;
          }
        } catch (e) {
          console.log(`❌ Found invalid JSON user data with key: ${key}, value: ${userData}`);
        }
      } else if (userData) {
        console.log(`❌ Found empty/null user data with key: ${key}, value: ${userData}`);
      }
    }
    
    // Check for direct user ID storage
    const userIdKeys = ['userId', 'user_id', 'currentUserId', 'id'];
    let hasDirectUserId = false;
    
    for (const key of userIdKeys) {
      const userId = localStorage.getItem(key);
      if (userId && userId.trim() !== '' && userId !== 'null' && userId !== 'undefined') {
        console.log(`✅ Found direct user ID with key: ${key}, value: ${userId}`);
        hasDirectUserId = true;
        break;
      }
    }
    
    const loggedIn = hasToken || hasUserData || hasDirectUserId;
    console.log('=== LOGIN STATUS SUMMARY ===');
    console.log('Has Token:', hasToken);
    console.log('Has User Data:', hasUserData);
    console.log('Has Direct User ID:', hasDirectUserId);
    console.log('Final Login Status:', loggedIn);
    console.log('========================');
    
    return loggedIn;
  };

  // Decode JWT token to extract user ID
  const decodeJWT = (token) => {
    try {
      // JWT tokens have 3 parts separated by dots: header.payload.signature
      const base64Payload = token.split('.')[1];
      
      // Decode base64 (handle URL-safe base64)
      const payload = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = atob(payload);
      
      // Parse JSON
      const parsedPayload = JSON.parse(decodedPayload);
      console.log('Decoded JWT payload:', parsedPayload);
      
      return parsedPayload;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  };

  // Get user ID from stored user data or JWT token
  const getUserId = () => {
    try {
      console.log('=== GETTING USER ID ===');
      
      // First, try to get user ID from stored user data
      const possibleKeys = ['user', 'userData', 'currentUser', 'authUser', 'loggedInUser', 'userInfo'];
      
      for (const key of possibleKeys) {
        const userData = localStorage.getItem(key);
        if (userData && userData !== 'null' && userData !== 'undefined') {
          console.log(`Found user data in localStorage with key: ${key}`, userData);
          
          const user = JSON.parse(userData);
          console.log('Parsed user object:', user);
          
          // Try common user ID field names
          const userId = user.id || user.userId || user._id || user.ID || user.user_id || user.sub;
          
          if (userId) {
            console.log('Found user ID from user data:', userId);
            return userId;
          }
        }
      }
      
      // If no user data found, try to get user ID stored directly
      const directUserIdKeys = ['userId', 'user_id', 'currentUserId', 'id'];
      for (const key of directUserIdKeys) {
        const directUserId = localStorage.getItem(key);
        if (directUserId && directUserId !== 'null' && directUserId !== 'undefined') {
          console.log('Found direct user ID:', directUserId);
          return directUserId;
        }
      }
      
      // Finally, try to extract user ID from JWT token
      const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
      if (token) {
        console.log('Attempting to decode JWT token for user ID...');
        const decodedToken = decodeJWT(token);
        
        if (decodedToken) {
          // Try common JWT payload field names for user ID
          const userId = decodedToken.id || decodedToken.userId || decodedToken.sub || decodedToken.user_id || decodedToken._id || decodedToken.ID;
          
          if (userId) {
            console.log('Found user ID from JWT token:', userId);
            return userId;
          } else {
            console.log('No user ID field found in JWT payload. Available fields:', Object.keys(decodedToken));
          }
        }
      }
      
      console.log('No user ID found anywhere');
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  const handleCardClick = () => {
    navigate(`/book/${id}`);
  };

  const handlePremiumRedirect = (e) => {
    e.stopPropagation();
    navigate('/login');
  };

  const addToWishlist = async (userId, bookId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('Making wishlist API call with:', { book_id: bookId });
      
      const response = await fetch('http://localhost:3000/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Backend uses verifyToken middleware
        },
        body: JSON.stringify({
          book_id: bookId, // Backend expects 'book_id', not 'bookId'
          // Note: user_id is not needed - backend gets it from JWT token
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Wishlist API success:', data);
      return data;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      throw error;
    }
  };

  const handleWishlistClick = async (e) => {
    e.stopPropagation();

    // Check if user is logged in
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    // If already in wishlist, don't do anything (or implement remove functionality)
    if (isInWishlist) {
      return;
    }

    setIsAddingToWishlist(true);

    try {
      const userId = getUserId();
      
      if (!userId) {
        console.error('User ID not found');
        navigate('/login');
        return;
      }

      await addToWishlist(userId, id);
      
      // Success - update UI
      setIsInWishlist(true);
      
      // Show success message
      console.log('✅ Book added to wishlist successfully!');
      
    } catch (error) {
      console.error('Failed to add book to wishlist:', error);
      
      // Optional: Show error message to user
      alert('Failed to add book to wishlist. Please try again.');
      
    } finally {
      setIsAddingToWishlist(false);
    }
  };

  return (
    <div className="book-card" onClick={handleCardClick}>
      <div
        className="book-image"
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
        }}
      />

      <div className="book-details">
        <div className="rating-row">
          <span className="avg-rating">
            <FaStar className="star-icon yellow" /> {averageRating}
          </span>
          <FaStar
            className="star-icon interactive"
            onClick={handlePremiumRedirect}
            title="Rate (Premium)"
          />
        </div>

        <div className="book-title">{title}</div>
        <div className="book-author">{author}</div>
      </div>

      <div 
        className={`wishlist-section ${isInWishlist ? 'in-wishlist' : ''} ${isAddingToWishlist ? 'loading' : ''}`}
        onClick={handleWishlistClick}
      >
        {isAddingToWishlist ? (
          <>
            <div className="loading-spinner" /> Adding...
          </>
        ) : isInWishlist ? (
          <>
            <FaCheck className="check-icon" /> In Wishlist
          </>
        ) : (
          <>
            <FaPlus className="plus-icon" /> Wishlist
          </>
        )}
      </div>
    </div>
  );
};

export default BookCard;