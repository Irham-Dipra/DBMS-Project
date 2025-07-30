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
  const [currentAverageRating, setCurrentAverageRating] = useState(averageRating);
  const [isRating, setIsRating] = useState(false);
  const [currentReadStatus, setCurrentReadStatus] = useState(isRead);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);

  // New: track shelf locally for instant UI update
  const [currentShelf, setCurrentShelf] = useState(shelf);

  const isLoggedIn = () => {
    // Your existing isLoggedIn code...
    // (unchanged for brevity)
    // ...
    return true; // Simplify here, or keep your logic
  };

  const decodeJWT = (token) => {
    // Your existing decodeJWT code...
    // ...
  };

  const getUserId = () => {
    // Your existing getUserId code...
    // ...
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
      
      const response = await fetch('http://localhost:3000/myBooks/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookId: bookId,
          shelf: 'want-to-read'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add to wishlist');
      }

      console.log('✅ Book added to wishlist successfully!');
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
      throw error;
    }
  };

  const removeFromWishlist = async (userId, bookId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`http://localhost:3000/myBooks/books/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove from wishlist');
      }

      console.log('✅ Book removed from wishlist successfully!');
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      throw error;
    }
  };

  const handleWishlistClick = async () => {
    if (isAddingToWishlist || currentShelf === 'currently-reading' || currentShelf === 'read') return;

    setIsAddingToWishlist(true);

    try {
      if (isInWishlist) {
        await removeFromWishlist(getUserId(), id);
        setIsInWishlist(false);
        setCurrentShelf(null);  // Remove from wishlist means no shelf
      } else {
        await addToWishlist(getUserId(), id);
        setIsInWishlist(true);
        setCurrentShelf('want-to-read');  // Added to wishlist
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
    } finally {
      setIsAddingToWishlist(false);
    }
  };

  // In BookCard.js - Replace the handleRatingChange and addBookToLibrary functions

// <<<<<<< newbranch
//     if (!isInUserLibrary) {
//       await addBookToLibrary(rating);
//       return;
//     }

//     setIsRating(true);
//     try {
//       const token = localStorage.getItem('token') || localStorage.getItem('authToken');

//       const response = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`,
//         },
//         body: JSON.stringify({ rating }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
// =======
const handleRatingChange = async (rating) => {
  if (!isLoggedIn()) {
    navigate('/login');
    return;
  }

  setIsRating(true);
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    // Always try to rate directly first
    let rateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        rating: rating
      })
    });

    // If rating fails because book is not in library, add it first
    if (!rateResponse.ok) {
      const errorData = await rateResponse.json();
      
      // Check if error is due to book not being in library
      if (rateResponse.status === 404 || errorData.message?.includes('not found') || errorData.message?.includes('not in library')) {
        console.log('Book not in library, adding it first...');
        
        // Add book to library first
        const addResponse = await fetch('http://localhost:3000/myBooks/books', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            bookId: id,
            shelf: 'want-to-read'
          })
        });

        // If adding fails because book already exists, ignore the error and proceed to rating
        if (!addResponse.ok) {
          const addErrorData = await addResponse.json();
          console.log('Add to library response:', addErrorData);
          
          // Only throw error if it's not a "already exists" type error
          if (!addErrorData.message?.includes('already') && !addErrorData.message?.includes('exists')) {
            throw new Error(addErrorData.message || 'Failed to add book to library');
          }
          console.log('Book already in library, proceeding to rate...');
        }

        // Now try rating again
        rateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
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
          const rateErrorData = await rateResponse.json();
          console.error('Rating error after adding to library:', rateErrorData);
          throw new Error(rateErrorData.message || 'Failed to update rating');
        }
      } else {
        // Different error, throw it
        console.error('Rating error:', errorData);
        throw new Error(errorData.message || 'Failed to update rating');
      }
    }

    const data = await rateResponse.json();
    setCurrentUserRating(rating);
    
    // Update average rating if provided by backend
    if (data.newAverageRating) {
      setCurrentAverageRating(data.newAverageRating);
    }
    
    console.log('✅ Rating updated successfully!');
    
  } catch (error) {
    console.error('Failed to update rating:', error);
    alert('Failed to update rating. Please try again.');
  } finally {
    setIsRating(false);
  }
};

// <<<<<<< newbranch
//   const addBookToLibrary = async (rating) => {
//     setIsRating(true);
//     try {
//       const token = localStorage.getItem('token') || localStorage.getItem('authToken');

//       const addResponse = await fetch('http://localhost:3000/myBooks/books', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`,
//         },
//         body: JSON.stringify({ bookId: id, shelf: 'want-to-read' }),
//       });

//       if (!addResponse.ok) {
//         const errorData = await addResponse.json();
// =======
  const addBookToLibrary = async (rating = null, shelf = 'want-to-read') => {
  setIsRating(true);
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    // Add book to library
    const addResponse = await fetch('http://localhost:3000/myBooks/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookId: id,
        shelf: shelf
      })
    });

    // Handle "already exists" errors gracefully
    if (!addResponse.ok) {
      const errorData = await addResponse.json();
      
      if (errorData.message?.includes('already') || errorData.message?.includes('exists')) {
        console.log('Book already in library, proceeding...');
      } else {
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to add book to library');
      }
    }

// <<<<<<< newbranch
// =======
    // If rating was requested, rate the book
    if (rating) {
      const rateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });

      if (!rateResponse.ok) {
        const errorData = await rateResponse.json();
        console.error('Rating error:', errorData);
        throw new Error(errorData.message || 'Failed to update rating');
      }

      const data = await rateResponse.json();
      setCurrentUserRating(rating);
      
      if (data.newAverageRating) {
        setCurrentAverageRating(data.newAverageRating);
      }
    }
    
    console.log('✅ Book added to library' + (rating ? ' and rated' : '') + ' successfully!');
    
  } catch (error) {
    console.error('Failed to add book' + (rating ? ' and rate' : '') + ':', error);
    alert('Failed to add book' + (rating ? ' and rate' : '') + '. Please try again.');
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
        // Mark unread - remove shelf
        const updateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            shelf: null,
            dateRead: null,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.message || 'Failed to mark book as unread');
        }

        setCurrentReadStatus(false);
        setCurrentShelf(null); // Update shelf locally
        console.log('✅ Book marked as unread and removed from library!');
      } else {
        let response;

        if (!isInUserLibrary) {
          response = await fetch('http://localhost:3000/myBooks/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookId: id,
              shelf: 'read',
            }),
          });
        } else {
          response = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              shelf: 'read',
            }),
          });
        }

        if (!response.ok && response.status === 404) {
          response = await fetch('http://localhost:3000/myBooks/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookId: id,
              shelf: 'read',
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to mark book as read');
        }

        setCurrentReadStatus(true);
        setCurrentShelf('read'); // update shelf instantly

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
            <FaStar className="star-icon yellow" /> {currentAverageRating}
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
          className={`wishlist-section ${isInWishlist ? 'in-wishlist' : ''} ${isAddingToWishlist ? 'loading' : ''} ${(currentShelf === 'currently-reading' || currentShelf === 'read') ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!(currentShelf === 'currently-reading' || currentShelf === 'read') && !isAddingToWishlist) {
              handleWishlistClick();
            }
          }}
        >
          {isAddingToWishlist ? (
            <>
              <div className="loading-spinner" /> {isInWishlist ? 'Removing...' : 'Adding...'}
            </>
          ) : currentShelf === 'read' ? (
            <>
              <FaCheck className="check-icon" /> Already Read
            </>
          ) : currentShelf === 'currently-reading' ? (
            <>
              <FaCheck className="check-icon" /> Currently Reading
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
