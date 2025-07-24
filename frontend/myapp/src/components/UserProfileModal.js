// src/components/UserProfileModal.js
import React, { useState, useEffect } from 'react';
import './UserProfileModal.css';

const UserProfileModal = ({ userId, onClose }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/analytics/user-activity-profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserProfile(data);
      } else {
        setError(data.message || 'Failed to fetch user profile');
      }
    } catch (error) {
      setError('Error fetching user profile');
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEngagementLevel = (score) => {
    if (score >= 100) return { level: 'Elite', color: '#fbbf24', icon: '🏆' };
    if (score >= 50) return { level: 'Active', color: '#4299e1', icon: '🌟' };
    if (score >= 20) return { level: 'Moderate', color: '#10b981', icon: '✨' };
    if (score >= 5) return { level: 'Casual', color: '#9f7aea', icon: '👤' };
    return { level: 'New', color: '#6b7280', icon: '🆕' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFullName = (user) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username;
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Loading User Profile...</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Error</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!userProfile) return null;

  const { user, engagement, recent_reviews, login_history } = userProfile;
  const engagementInfo = getEngagementLevel(engagement.score);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-profile-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👤 User Profile</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="profile-content">
          {/* User Info Section */}
          <div className="user-info-section">
            <div className="user-avatar">
              {user.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">
                  {getFullName(user).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="user-details">
              <h3>{getFullName(user)}</h3>
              <p className="username">@{user.username}</p>
              <p className="email">{user.email}</p>
              {user.bio && <p className="bio">{user.bio}</p>}
              
              <div className="user-meta">
                <span className="joined">Joined: {formatDate(user.created_at)}</span>
                <span className={`status ${user.active_status ? 'active' : 'inactive'}`}>
                  {user.active_status ? '🟢 Active' : '🔴 Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Engagement Section */}
          <div className="engagement-section">
            <h3>🏆 Engagement Level</h3>
            <div className="engagement-card">
              <div className="engagement-level">
                <span className="level-icon">{engagementInfo.icon}</span>
                <span className="level-name" style={{ color: engagementInfo.color }}>
                  {engagementInfo.level}
                </span>
                <span className="level-score">{engagement.score} pts</span>
              </div>
              
              <div className="activity-breakdown">
                <div className="activity-stat">
                  <span className="stat-icon">📝</span>
                  <span className="stat-value">{engagement.activities.reviews?.count || 0}</span>
                  <span className="stat-label">Reviews</span>
                  <span className="stat-points">{(engagement.activities.reviews?.count || 0) * 5} pts</span>
                </div>

                <div className="activity-stat">
                  <span className="stat-icon">💬</span>
                  <span className="stat-value">{engagement.activities.comments?.count || 0}</span>
                  <span className="stat-label">Comments</span>
                  <span className="stat-points">{(engagement.activities.comments?.count || 0) * 3} pts</span>
                </div>

                <div className="activity-stat">
                  <span className="stat-icon">👍</span>
                  <span className="stat-value">{engagement.activities.votes?.count || 0}</span>
                  <span className="stat-label">Votes</span>
                  <span className="stat-points">{(engagement.activities.votes?.count || 0) * 1} pts</span>
                </div>

                <div className="activity-stat">
                  <span className="stat-icon">📚</span>
                  <span className="stat-value">{engagement.activities.books_added?.count || 0}</span>
                  <span className="stat-label">Books Added</span>
                  <span className="stat-points">-</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Reviews */}
          {recent_reviews && recent_reviews.length > 0 && (
            <div className="recent-reviews-section">
              <h3>📖 Recent Reviews</h3>
              <div className="reviews-list">
                {recent_reviews.map(review => (
                  <div key={review.id} className="review-item">
                    <div className="review-header">
                      <h4>{review.title}</h4>
                      <div className="review-rating">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`star ${i < review.rating ? 'filled' : 'empty'}`}>
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="review-book">on "{review.book_title}"</p>
                    <p className="review-excerpt">{review.body.substring(0, 100)}...</p>
                    <span className="review-date">{formatDate(review.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Login History */}
          {login_history && login_history.length > 0 && (
            <div className="login-history-section">
              <h3>🔐 Recent Login History</h3>
              <div className="login-list">
                {login_history.slice(0, 5).map((login, index) => (
                  <div key={index} className="login-item">
                    <div className="login-info">
                      <span className="login-time">{formatDate(login.login_time)}</span>
                      {login.logout_time && (
                        <span className="logout-time">- {formatDate(login.logout_time)}</span>
                      )}
                    </div>
                    <span className="login-ip">{login.ip_address}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;