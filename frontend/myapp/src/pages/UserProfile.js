import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './UserProfile.css';
import BookCard from '../components/BookCard';
import { FaBook, FaUserCircle, FaStar, FaCalendar } from 'react-icons/fa';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userBooks, setUserBooks] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        
        // Fetch user basic info
        console.log('Fetching user profile for userId:', userId);
        const userRes = await fetch(`http://localhost:3000/users/${userId}`);
        if (!userRes.ok) {
          console.error('User fetch failed:', userRes.status, userRes.statusText);
          throw new Error('User not found');
        }
        const userData = await userRes.json();
        console.log('User data received:', userData);
        setUser(userData);

        // Fetch user's public books
        const booksRes = await fetch(`http://localhost:3000/users/${userId}/books`);
        if (booksRes.ok) {
          const booksData = await booksRes.json();
          setUserBooks(booksData);
        }

        // Fetch user's reviews
        const reviewsRes = await fetch(`http://localhost:3000/users/${userId}/reviews`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setUserReviews(reviewsData);
        }

        // Fetch user's reading stats
        const statsRes = await fetch(`http://localhost:3000/users/${userId}/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="user-profile-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-profile-container">
        <div className="error-state">
          <h2>Profile Not Found</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header-section">
        <div className="profile-container">
          <div className="profile-picture-section">
            <div className="profile-picture">
              {user.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="Profile" />
              ) : (
                <div className="profile-initials">
                  {user.first_name && user.last_name
                    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
                    : user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="profile-info">
              <h1 className="profile-name">
                {user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user.username}
              </h1>
              <p className="profile-username">@{user.username}</p>
              {user.bio && <p className="profile-bio">{user.bio}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="profile-content">
        {/* Sidebar */}
        <div className="profile-sidebar">
          {/* Reading Stats Widget */}
          {stats && (
            <div className="sidebar-section">
              <h3>📊 Reading Stats</h3>
              <div className="stats-widget">
                <div className="stat-row">
                  <span className="stat-label">📚 Total Books</span>
                  <span className="stat-value">{stats.total_books || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">✅ Books Read</span>
                  <span className="stat-value">{stats.books_read || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">📝 Reviews</span>
                  <span className="stat-value">{stats.total_reviews || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">📅 Joined</span>
                  <span className="stat-value">{formatDate(user.created_at).split(' ').slice(-1)[0]}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Feed */}
        <div className="profile-main">
          {/* My Books Section */}
          {userBooks.length > 0 && (
            <div className="content-section">
              <div className="section-header">
                <h2>📚 Books</h2>
              </div>
              <div className="books-grid">
                {userBooks.slice(0, 12).map((book) => (
                  <BookCard
                    key={book.id}
                    id={book.id}
                    title={book.title}
                    authorId={book.author_id}
                    authorName={book.author_name}
                    averageRating={book.average_rating}
                    coverUrl={book.cover_image}
                    userRating={0} // Public view, no user rating
                    isRead={book.shelf === 'read'}
                    hideActions={true} // Hide action buttons for public view
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          {userReviews.length > 0 && (
            <div className="content-section">
              <div className="section-header">
                <h2>⭐ Reviews</h2>
              </div>
              <div className="reviews-list">
                {userReviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="profile-review-header">
                      <img 
                        src={review.cover_image || '/default-book-cover.jpg'} 
                        alt={review.book_title}
                        className="book-cover-mini"
                      />
                      <div className="review-book-info">
                        <h4 className="review-book-title">{review.book_title}</h4>
                        <div className="profile-review-rating">
                          <div className="profile-review-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span 
                                key={star} 
                                className={`star ${star <= review.rating ? 'filled' : 'empty'}`}
                              >
                                ⭐
                              </span>
                            ))}
                          </div>
                          <span className="profile-review-value">({review.rating}/5)</span>
                        </div>
                      </div>
                      <div className="profile-review-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="review-content-section">
                      {review.title && (
                        <h5 className="profile-review-title">{review.title}</h5>
                      )}
                      <p className="profile-review-body">
                        {review.body.length > 200 
                          ? `${review.body.substring(0, 200)}...` 
                          : review.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userBooks.length === 0 && userReviews.length === 0 && (
            <div className="empty-state">
              <p>This user hasn't added any books or reviews yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;