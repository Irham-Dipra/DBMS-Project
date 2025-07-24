import React, { useState } from 'react';
import './BookCard.css';
import { useNavigate } from 'react-router-dom';
import { FaStar, FaPlus, FaCheck, FaCheckCircle } from 'react-icons/fa';
import RatingComponent from './RatingComponent';

const BookCard = ({
  id,
  title = 'Sample Book Title',
  author = 'Author Name',
  authorId = null,
  onAuthorClick = null,
  averageRating = 4.5,
  coverUrl = '',
  userRating = 0,
  isInUserLibrary = false,
  shelf = null,
  isRead = false,
  isInWishlist: initialIsInWishlist = false,
}) => {
  const navigate = useNavigate();
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(initialIsInWishlist || shelf === 'want-to-read');
  const [currentUserRating, setCurrentUserRating] = useState(userRating);
  const [, setIsRating] = useState(false);
  const [currentReadStatus, setCurrentReadStatus] = useState(isRead);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);

  // Check if user is logged in (you might need to adjust this based on your auth implementation)
  const isLoggedIn = () => {
    console.log('=== CHECKING LOGIN STATUS ===');
    console.log('All localStorage contents:', { ...localStorage });
    
    // Check for common auth token keys
    const tokenKeys = ['authToken', 'token', 'accessToken', 'jwt', 'authJWT', 'Bearer'];
    let hasToken = false;
    
    for (const key of tokenKeys) {
      const token = localStorage.getItem(key);
      if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
        console.log(`✅ Found valid auth token with key: ${key}, value: ${token.substring(0, 20)}...`);
        hasToken = true;
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


  const handleAuthorClick = (e) => {
    e.stopPropagation();
    if (authorId && onAuthorClick) {
      onAuthorClick(authorId);
    } else if (authorId) {
      navigate(`/author/${authorId}`);
    }
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

  const removeFromWishlist = async (userId, bookId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('Making remove from wishlist API call with:', { book_id: bookId });
      
      const response = await fetch(`http://localhost:3000/wishlist/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Remove from wishlist response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Remove from wishlist API success:', data);
      return data;
    } catch (error) {
      console.error('Error removing from wishlist:', error);
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

    // Prevent adding to wishlist if book is already marked as read
    if (!isInWishlist && currentReadStatus) {
      alert('Cannot add a book that is already marked as read to wishlist.');
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

      if (isInWishlist) {
        // Remove from wishlist
        await removeFromWishlist(userId, id);
        setIsInWishlist(false);
        console.log('✅ Book removed from wishlist successfully!');
      } else {
        // Add to wishlist
        await addToWishlist(userId, id);
        setIsInWishlist(true);
        console.log('✅ Book added to wishlist successfully!');
      }
      
    } catch (error) {
      console.error('Failed to update wishlist:', error);
      alert('Failed to update wishlist. Please try again.');
      
    } finally {
      setIsAddingToWishlist(false);
    }
  };

  const handleRatingChange = async (rating) => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    // If book is not in user's library, add it first then rate
    if (!isInUserLibrary) {
      await addBookToLibrary(rating);
      return;
    }

    setIsRating(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Use dedicated rating endpoint
      const response = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: rating
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to update rating');
      }

      setCurrentUserRating(rating);
      console.log('✅ Rating updated successfully!');
      
    } catch (error) {
      console.error('Failed to update rating:', error);
      alert('Failed to update rating. Please try again.');
    } finally {
      setIsRating(false);
    }
  };

  const addBookToLibrary = async (rating) => {
    setIsRating(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // First add book to library with default shelf for rating
      const addResponse = await fetch('http://localhost:3000/myBooks/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookId: id,
          shelf: 'want-to-read'  // Default shelf for books added for rating
        })
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to add book to library');
      }

      // Then rate the book using the dedicated rating endpoint
      const rateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: rating
        })
      });

      if (!rateResponse.ok) {
        const errorData = await rateResponse.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to update rating');
      }

      setCurrentUserRating(rating);
      console.log('✅ Book added to library and rated successfully!');
      
    } catch (error) {
      console.error('Failed to add book and rate:', error);
      alert('Failed to add book and rate. Please try again.');
    } finally {
      setIsRating(false);
    }
  };

  const handleMarkAsRead = async (e) => {
    e.stopPropagation();

    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    setIsMarkingAsRead(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (currentReadStatus) {
        // Book is currently read - mark as unread
        const updateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            shelf: null, // Remove from any shelf
            dateRead: null // Clear read date
          })
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.message || 'Failed to mark book as unread');
        }

        setCurrentReadStatus(false);
        // Book is now removed from library entirely
        // Update UI state to reflect this
        console.log('✅ Book marked as unread and removed from library!');

      } else {
        // Book is not read - mark as read
        console.log('Debug: isInUserLibrary =', isInUserLibrary, 'isInWishlist =', isInWishlist, 'shelf =', shelf);
        let response;
        
        if (!isInUserLibrary) {
          // Add book to library first with "read" shelf
          response = await fetch('http://localhost:3000/myBooks/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookId: id,
              shelf: 'read'
            })
          });
        } else {
          // Update existing book to "read" shelf (works for wishlist books too)
          response = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              shelf: 'read'
            })
          });
        }

        // If PUT failed with 404 (book not found), try POST instead
        if (!response.ok && response.status === 404) {
          console.log('Book not found in library, trying to add it...');
          response = await fetch('http://localhost:3000/myBooks/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookId: id,
              shelf: 'read'
            })
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.message || 'Failed to mark book as read');
        }

        setCurrentReadStatus(true);
        
        // If book was in wishlist, it's now marked as read (shelf changed from want-to-read to read)
        if (isInWishlist) {
          setIsInWishlist(false);
          console.log('✅ Book moved from wishlist to read status');
        }
        
        console.log('✅ Book marked as read successfully!');
      }
      
    } catch (error) {
      console.error('Failed to update read status:', error);
      alert('Failed to update read status. Please try again.');
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  return (
    <div className="book-card" onClick={handleCardClick}>
      <div
        className="book-image"
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
        }}
      >
        <div 
          className={`read-button ${currentReadStatus ? 'is-read' : ''} ${isMarkingAsRead ? 'loading' : ''}`}
          onClick={handleMarkAsRead}
        >
          <FaCheckCircle className="read-icon" />
        </div>
      </div>

      <div className="book-details">
        <div className="rating-row">
          <span className="avg-rating">
            <FaStar className="star-icon yellow" /> {averageRating}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <RatingComponent
              currentRating={currentUserRating}
              onRatingChange={handleRatingChange}
              isInteractive={true}
              size="small"
            />
          </div>
        </div>

        <div className="book-title">{title}</div>
        <div 
          className={`book-author ${authorId ? 'clickable' : ''}`}
          onClick={authorId ? handleAuthorClick : undefined}
        >
          {author}
        </div>
      </div>

      <div className="book-actions">
        <div 
          className={`wishlist-section ${isInWishlist ? 'in-wishlist' : ''} ${isAddingToWishlist ? 'loading' : ''} ${currentReadStatus ? 'disabled' : ''}`}
          onClick={handleWishlistClick}
        >
          {isAddingToWishlist ? (
            <>
              <div className="loading-spinner" /> {isInWishlist ? 'Removing...' : 'Adding...'}
            </>
          ) : currentReadStatus ? (
            <>
              <FaCheck className="check-icon" /> Already Read
            </>
          ) : isInWishlist ? (
            <>
              <FaCheck className="check-icon" /> Remove from Wishlist
            </>
          ) : (
            <>
              <FaPlus className="plus-icon" /> Add to Wishlist
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCard;