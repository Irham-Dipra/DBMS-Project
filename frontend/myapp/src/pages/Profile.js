// src/pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import BookCard from '../components/BookCard';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [myBooks, setMyBooks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          localStorage.removeItem('loggedIn');
          setMessage('Not logged in.');
          setIsLoading(false);
          setTimeout(() => navigate('/login'), 1500);
          return;
        }

        const res = await fetch('http://localhost:3000/auth/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (data.success && data.user) {
          setUser(data.user);
          setEditForm({
            first_name: data.user.first_name || '',
            last_name: data.user.last_name || '',
            bio: data.user.bio || '',
            profile_picture_url: data.user.profile_picture_url || ''
          });
          setIsLoading(false);
          await fetchMyBooks();
          await fetchMyReviews();
          await fetchReadingStats();
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('loggedIn');
          setMessage(data.message || 'Session expired. Please login again.');
          setIsLoading(false);
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('loggedIn');
        setMessage('Network error. Please try again.');
        setIsLoading(false);
        console.error(err);
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    fetchUser();
  }, [navigate]);

  const fetchMyBooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/myBooks/books?limit=6', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setMyBooks(data.books);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    }
  };

  const fetchMyReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/reviews/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setReviews(data.reviews.slice(0, 5)); // Show only 5 recent reviews
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchReadingStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/myBooks/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching reading stats:', error);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (data.success) {
        setUser({ ...user, ...editForm });
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('http://localhost:3000/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('loggedIn');
    navigate('/');
    window.location.reload();
  };

  const getFullName = (user) => {
    if (!user) return '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    }
    return user.username || 'User';
  };

  const getUserInitials = (user) => {
    if (!user) return '👤';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (user.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return '👤';
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <h2>Loading your profile...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <h2>{message || 'Something went wrong...'}</h2>
          <p>Redirecting to login...</p>
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
                <div className="profile-initials">{getUserInitials(user)}</div>
              )}
            </div>
            <div className="profile-info">
              <h1 className="profile-name">{getFullName(user)}</h1>
              <p className="profile-username">@{user.username}</p>
              {user.is_moderator && (
                <p className="profile-moderator-badge">Moderator</p>
              )}
              {user.bio && <p className="profile-bio">{user.bio}</p>}
              
              {/* Deactivation Status */}
              {!user.is_active && (
                <div className="deactivation-status">
                  <div className="deactivation-header">
                    <span className="deactivation-badge">🚫 Account Deactivated</span>
                    {user.days_until_reactivation !== null && user.days_until_reactivation > 0 && (
                      <span className="reactivation-countdown">
                        Reactivates in {user.days_until_reactivation} days
                      </span>
                    )}
                  </div>
                  {user.deactivation_reason && (
                    <div className="deactivation-reason">
                      <strong>Reason:</strong> {user.deactivation_reason}
                    </div>
                  )}
                  {user.deactivated_at && (
                    <div className="deactivation-date">
                      <strong>Deactivated on:</strong> {new Date(user.deactivated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="profile-actions">
            <button className="edit-profile-btn" onClick={handleEditProfile}>
              ✏️ Edit Profile
            </button>
            {user.is_moderator && (
              <button className="moderator-dashboard-btn" onClick={() => navigate('/moderator-dashboard')}>
                🔧 Moderator Dashboard
              </button>
            )}
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="profile-content">
        {/* Sidebar */}
        <div className="profile-sidebar">
          <div className="sidebar-section">
            <h3>📚 My Library</h3>
            <ul className="sidebar-menu">
              <li onClick={() => navigate('/my-books')}>📖 All Books</li>
              <li onClick={() => navigate('/wishlist')}>❤️ Wishlist</li>
              <li>📊 Reading Stats</li>
            </ul>
          </div>

          {/* Reading Stats Widget */}
          {stats && (
            <div className="sidebar-section">
              <h3>📊 Reading Stats</h3>
              <div className="stats-widget">
                <div className="stat-row">
                  <span className="stat-label">📚 Total Books</span>
                  <span className="stat-value">{stats.total_books}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">✅ Read</span>
                  <span className="stat-value">{stats.books_read}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">📖 Reading</span>
                  <span className="stat-value">{stats.currently_reading}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">❤️ Want to Read</span>
                  <span className="stat-value">{stats.want_to_read}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">⭐ Avg Rating</span>
                  <span className="stat-value">{stats.avg_rating || 'N/A'}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">📝 Reviews</span>
                  <span className="stat-value">{stats.rated_books}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="sidebar-section">
            <h3>👥 Social</h3>
            <ul className="sidebar-menu">
              <li>👫 Friends <span className="coming-soon">Soon</span></li>
              <li>👥 Groups <span className="coming-soon">Soon</span></li>
              <li>📢 Activity <span className="coming-soon">Soon</span></li>
            </ul>
          </div>

          <div className="sidebar-section">
            <h3>⚙️ Settings</h3>
            <ul className="sidebar-menu">
              <li>🔔 Notifications <span className="coming-soon">Soon</span></li>
              <li>🔒 Privacy <span className="coming-soon">Soon</span></li>
              <li>🎨 Themes <span className="coming-soon">Soon</span></li>
            </ul>
          </div>
        </div>

        {/* Main Feed */}
        <div className="profile-main">
          {/* My Books Section */}
          <div className="content-section">
            <div className="section-header">
              <h2>📚 My Books</h2>
              <button className="view-all-btn" onClick={() => navigate('/my-books')}>
                View All
              </button>
            </div>
            <div className="books-grid">
              {myBooks.length > 0 ? (
                myBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    id={book.id}
                    title={book.title}
                    author={book.author}
                    averageRating={book.avg_rating}
                    coverUrl={book.cover_url}
                    userRating={book.user_rating || 0}
                    isRead={book.shelf === 'read'}
                    isInUserLibrary={true}
                    shelf={book.shelf}
                    isInWishlist={book.shelf === 'want-to-read'}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <p>No books in your library yet. Start building your collection!</p>
                  <button onClick={() => navigate('/')}>Browse Books</button>
                </div>
              )}
            </div>
          </div>

          {/* Reviews Section */}
          <div className="content-section">
            <div className="section-header">
              <h2>⭐ My Reviews</h2>
              <button className="view-all-btn">View All</button>
            </div>
            <div className="reviews-list">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="profile-review-header">
                      <img 
                        src={review.cover_image || '/default-book-cover.jpg'} 
                        alt={review.book_title}
                        className="book-cover-mini"
                      />
                      <div className="review-book-info">
                        <h4 className="review-book-title">{review.book_title}</h4>
                        <p className="review-book-author">by {review.author_name}</p>
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
                      <h5 className="profile-review-title">{review.review_title}</h5>
                      <p className="profile-review-body">{review.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No reviews yet. Share your thoughts on books you've read!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Profile Picture URL</label>
                <input
                  type="url"
                  value={editForm.profile_picture_url}
                  onChange={(e) => setEditForm({...editForm, profile_picture_url: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button className="save-btn" onClick={handleSaveProfile}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;