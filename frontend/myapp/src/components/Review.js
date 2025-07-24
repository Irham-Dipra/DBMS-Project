import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Review.css';
import { FaThumbsUp, FaThumbsDown, FaStar, FaUser, FaUserCircle } from 'react-icons/fa';

const Review = ({
  id,
  title = 'Review Title',
  body = 'This is the review body content...',
  reviewerName = 'Anonymous',
  firstName = '',
  lastName = '',
  userId,
  profilePictureUrl = '',
  bookTitle = 'Unknown Book',
  bookCoverUrl = '',
  authorName = 'Unknown Author',
  rating = 5,
  created_at = new Date().toISOString(),
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialUserVote = null,
}) => {
  const navigate = useNavigate();
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState(initialUserVote); // null, 'upvote', or 'downvote'

  // Format the date from created_at timestamp
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get display name for reviewer
  const getDisplayName = () => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    }
    return reviewerName;
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (reviewerName) {
      return reviewerName.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Render profile avatar with fallback
  const renderProfileAvatar = () => {
    if (profilePictureUrl) {
      return (
        <img 
          src={profilePictureUrl} 
          alt="Profile" 
          className="avatar-image"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    return null;
  };


  // Handle clicking on user name to navigate to profile
  const handleUserClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔥 USER NAME CLICKED! 🔥');
    console.log('userId:', userId);
    console.log('reviewerName:', reviewerName);
    console.log('firstName:', firstName);
    console.log('lastName:', lastName);
    
    if (userId) {
      console.log('Navigating to:', `/user-profile/${userId}`);
      navigate(`/user-profile/${userId}`);
    } else {
      console.warn('❌ No userId provided for navigation');
      alert('No user ID found - cannot navigate to profile');
    }
  };

  // Check if user is logged in (you might need to adjust this based on your auth implementation)
  const isLoggedIn = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return token && token !== 'null' && token !== 'undefined';
  };

  const handleUpvote = async (e) => {
    e.stopPropagation();
    
    if (!isLoggedIn()) {
      alert('Please login to vote on reviews');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3000/reviews/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vote_type: 'upvote'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      const data = await response.json();
      
      // Update state with server response
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
      setUserVote(data.user_vote);
      
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  const handleDownvote = async (e) => {
    e.stopPropagation();
    
    if (!isLoggedIn()) {
      alert('Please login to vote on reviews');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3000/reviews/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vote_type: 'downvote'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      const data = await response.json();
      
      // Update state with server response
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
      setUserVote(data.user_vote);
      
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <FaStar key={i} className="star-icon" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <FaStar key={i} className="star-icon" style={{ opacity: 0.5 }} />
        );
      } else {
        stars.push(
          <FaStar key={i} className="star-icon empty" />
        );
      }
    }

    return stars;
  };

  return (
    <div className="review-card">
      {/* TOP SECTION: Reviewer Info */}
      <div className="review-top-section">
        <div className="reviewer-info">
          <div className="reviewer-avatar">
            {renderProfileAvatar()}
            <div className="avatar-fallback" style={{ display: profilePictureUrl ? 'none' : 'flex' }}>
              <FaUserCircle className="avatar-icon" />
            </div>
          </div>
          <div className="reviewer-details">
            <h3 className="reviewer-name" onClick={handleUserClick}>{getDisplayName()}</h3>
            <span className="reviewer-username">@{reviewerName}</span>
            <span className="review-date">{formatDate(created_at)}</span>
          </div>
        </div>
      </div>

      {/* BOOK SECTION: Book Info */}
      <div className="book-section">
        <div className="book-cover-container">
          {bookCoverUrl && bookCoverUrl.trim() !== '' ? (
            <>
              <img 
                src={bookCoverUrl} 
                alt={bookTitle} 
                className="book-cover-image"
                onError={(e) => {
                  console.log('Book cover failed to load:', bookCoverUrl);
                  e.target.style.display = 'none';
                  e.target.parentNode.querySelector('.book-cover-fallback').style.display = 'flex';
                }}
                onLoad={(e) => {
                  // Hide fallback when image loads successfully
                  e.target.parentNode.querySelector('.book-cover-fallback').style.display = 'none';
                }}
              />
              <div className="book-cover-fallback" style={{ display: 'none' }}>
                <FaStar className="book-icon" />
              </div>
            </>
          ) : (
            <div className="book-cover-fallback">
              <FaStar className="book-icon" />
            </div>
          )}
        </div>
        <div className="book-details">
          <h2 className="book-title">{bookTitle}</h2>
          <p className="book-author">by {authorName}</p>
          <div className="review-rating">
            <div className="rating-stars">
              {renderStars(rating)}
            </div>
            <span className="rating-value">({rating}/5)</span>
          </div>
        </div>
      </div>

      {/* REVIEW CONTENT */}
      <div className="review-content">
        {title && (
          <h4 className="review-title">{title}</h4>
        )}
        <div className="review-body">
          {body}
        </div>
      </div>

      {/* ACTIONS SECTION */}
      <div className="review-actions">
        <div className="vote-section">
          <button 
            className={`vote-button upvote ${userVote === 'upvote' ? 'active' : ''}`}
            onClick={handleUpvote}
            title="Upvote this review"
          >
            <FaThumbsUp className="vote-icon" />
            <span className="vote-count">{upvotes}</span>
          </button>

          <button 
            className={`vote-button downvote ${userVote === 'downvote' ? 'active' : ''}`}
            onClick={handleDownvote}
            title="Downvote this review"
          >
            <FaThumbsDown className="vote-icon" />
            <span className="vote-count">{downvotes}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Review;