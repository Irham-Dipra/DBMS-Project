import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaThumbsUp, FaThumbsDown, FaStar, FaComment, FaBook, FaUser, FaReply } from 'react-icons/fa';
import Navbar from '../components/Navbar';
import './Browse.css';

function Browse() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [showAllComments, setShowAllComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [replyTexts, setReplyTexts] = useState({});
  const [submittingReply, setSubmittingReply] = useState({});
  const [replies, setReplies] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
    const userId = localStorage.getItem('userId');
    
    setLoggedIn(!!token || isLoggedIn);
    setCurrentUserId(userId ? parseInt(userId) : null);
  }, []);

  useEffect(() => {
    fetchAllReviews();
  }, [currentUserId]);

  const fetchAllReviews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('http://localhost:3000/reviews/all', { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      
      const data = await response.json();
      
      // Filter out current user's reviews
      const filteredReviews = data.filter(review => 
        review.user_id !== currentUserId
      );
      
      setReviews(filteredReviews);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (reviewId, voteType) => {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3000/reviews/${reviewId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vote_type: voteType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      const result = await response.json();
      
      // Update the review in the state
      setReviews(prevReviews => 
        prevReviews.map(review => 
          review.id === reviewId 
            ? { 
                ...review, 
                upvotes: result.upvotes, 
                downvotes: result.downvotes,
                user_vote: result.user_vote
              }
            : review
        )
      );
    } catch (err) {
      console.error('Error voting:', err);
      alert('Failed to vote. Please try again.');
    }
  };

  const toggleComments = (reviewId) => {
    setExpandedComments(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };

  const handleCommentSubmit = async (reviewId) => {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    const commentText = commentTexts[reviewId]?.trim();
    if (!commentText) return;

    try {
      setSubmittingComment(prev => ({ ...prev, [reviewId]: true }));
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`http://localhost:3000/reviews/${reviewId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment: commentText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const result = await response.json();
      
      // Update the review with new comment
      setReviews(prevReviews => 
        prevReviews.map(review => 
          review.id === reviewId 
            ? { 
                ...review, 
                comments: [...(review.comments || []), {
                  ...result.comment,
                  upvotes: 0,
                  downvotes: 0,
                  user_vote: null
                }]
              }
            : review
        )
      );
      
      // Clear comment text
      setCommentTexts(prev => ({ ...prev, [reviewId]: '' }));
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  const handleCommentVote = async (commentId, voteType) => {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3000/reviews/comments/${commentId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vote_type: voteType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to vote on comment');
      }

      const result = await response.json();
      
      // Update the comment in the state
      setReviews(prevReviews => 
        prevReviews.map(review => ({
          ...review,
          comments: review.comments.map(comment => 
            comment.id === commentId 
              ? { 
                  ...comment, 
                  upvotes: result.upvotes, 
                  downvotes: result.downvotes,
                  user_vote: result.user_vote
                }
              : comment
          )
        }))
      );
      
      // Update the reply in the state if it exists
      setReplies(prevReplies => {
        const newReplies = { ...prevReplies };
        Object.keys(newReplies).forEach(parentId => {
          if (newReplies[parentId]) {
            newReplies[parentId] = newReplies[parentId].map(reply => 
              reply.id === commentId 
                ? { 
                    ...reply, 
                    upvotes: result.upvotes, 
                    downvotes: result.downvotes,
                    user_vote: result.user_vote
                  }
                : reply
            );
          }
        });
        return newReplies;
      });
    } catch (err) {
      console.error('Error voting on comment:', err);
      alert('Failed to vote on comment. Please try again.');
    }
  };

  const toggleReplies = async (commentId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
    
    // Fetch replies if expanding and not already loaded
    if (!expandedReplies[commentId] && !replies[commentId]) {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`http://localhost:3000/reviews/comments/${commentId}/replies`, { headers });
        
        if (!response.ok) {
          throw new Error('Failed to fetch replies');
        }
        
        const data = await response.json();
        setReplies(prev => ({
          ...prev,
          [commentId]: data.replies
        }));
      } catch (err) {
        console.error('Error fetching replies:', err);
      }
    }
  };

  const handleReplySubmit = async (parentCommentId) => {
    if (!loggedIn) {
      navigate('/login');
      return;
    }

    const replyText = replyTexts[parentCommentId]?.trim();
    if (!replyText) return;

    try {
      setSubmittingReply(prev => ({ ...prev, [parentCommentId]: true }));
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Find the review ID for this comment
      let reviewId = null;
      for (const review of reviews) {
        if (review.comments.some(c => c.id === parentCommentId)) {
          reviewId = review.id;
          break;
        }
      }
      
      if (!reviewId) {
        throw new Error('Review not found');
      }
      
      const response = await fetch(`http://localhost:3000/reviews/${reviewId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment: replyText,
          parent_comment_id: parentCommentId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post reply');
      }

      const result = await response.json();
      
      // Update the replies state
      setReplies(prev => ({
        ...prev,
        [parentCommentId]: [...(prev[parentCommentId] || []), {
          ...result.comment,
          user_vote: null
        }]
      }));
      
      // Update the parent comment's reply count
      setReviews(prevReviews => 
        prevReviews.map(review => ({
          ...review,
          comments: review.comments.map(comment => 
            comment.id === parentCommentId 
              ? { ...comment, reply_count: (comment.reply_count || 0) + 1 }
              : comment
          )
        }))
      );
      
      // Clear reply text
      setReplyTexts(prev => ({ ...prev, [parentCommentId]: '' }));
    } catch (err) {
      console.error('Error posting reply:', err);
      alert('Failed to post reply. Please try again.');
    } finally {
      setSubmittingReply(prev => ({ ...prev, [parentCommentId]: false }));
    }
  };

  const getDisplayName = (review) => {
    if (review.first_name && review.last_name) {
      return `${review.first_name} ${review.last_name}`;
    } else if (review.first_name) {
      return review.first_name;
    }
    return review.user_name || 'Anonymous';
  };

  const getUserInitials = (review) => {
    if (review.first_name && review.last_name) {
      return `${review.first_name.charAt(0)}${review.last_name.charAt(0)}`.toUpperCase();
    } else if (review.first_name) {
      return review.first_name.charAt(0).toUpperCase();
    } else if (review.user_name) {
      return review.user_name.charAt(0).toUpperCase();
    }
    return '?';
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="browse-page">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="browse-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading reviews...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="browse-page">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="browse-container">
          <div className="error-state">
            <p>Error: {error}</p>
            <button onClick={fetchAllReviews}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="browse-page">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />
      
      
      <div className="browse-container">
        <div className="browse-header">
          <h1>Browse Reviews</h1>
          <p>Discover what fellow readers are saying about books</p>
        </div>

        {reviews.length === 0 ? (
          <div className="no-reviews-state">
            <FaBook className="no-reviews-icon" />
            <h2>No reviews yet</h2>
            <p>Be the first to share your thoughts on a book!</p>
          </div>
        ) : (
          <div className="reviews-grid">
            {reviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="review-user">
                    <div className="user-avatar">
                      {review.profile_picture_url ? (
                        <img src={review.profile_picture_url} alt="Profile" />
                      ) : (
                        <div className="avatar-placeholder">
                          {getUserInitials(review)}
                        </div>
                      )}
                    </div>
                    <div className="user-info">
                      <h3 className="user-name">{getDisplayName(review)}</h3>
                      <p className="review-date">{formatDate(review.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="review-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar 
                        key={star} 
                        className={`star ${star <= review.rating ? 'filled' : 'empty'}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="review-book-info">
                  <h4 className="book-title" onClick={() => navigate(`/book/${review.book_id}`)}>
                    {review.book_title}
                  </h4>
                  <p className="book-author">by {review.author_name || 'Unknown Author'}</p>
                </div>

                <div className="review-content">
                  <h5 className="review-title">{review.title}</h5>
                  <p className="review-text">{review.body}</p>
                </div>

                <div className="review-actions">
                  <div className="vote-section">
                    <button 
                      className={`vote-btn upvote ${review.user_vote === 'upvote' ? 'active' : ''}`}
                      onClick={() => handleVote(review.id, 'upvote')}
                      disabled={!loggedIn}
                    >
                      <FaThumbsUp />
                      <span>{review.upvotes || 0}</span>
                    </button>
                    
                    <button 
                      className={`vote-btn downvote ${review.user_vote === 'downvote' ? 'active' : ''}`}
                      onClick={() => handleVote(review.id, 'downvote')}
                      disabled={!loggedIn}
                    >
                      <FaThumbsDown />
                      <span>{review.downvotes || 0}</span>
                    </button>
                  </div>

                  <button 
                    className="comment-btn"
                    onClick={() => toggleComments(review.id)}
                  >
                    <FaComment />
                    <span>{review.comments?.length || 0} Comments</span>
                  </button>
                </div>

                {expandedComments[review.id] && (
                  <div className="comments-section">
                    <div className="comments-list">
                      {(showAllComments[review.id] 
                        ? review.comments 
                        : review.comments?.slice(0, 3)
                      )?.map((comment, index) => (
                        <div key={comment.id} className="comment">
                          <div className="comment-header">
                            <div className="comment-user">
                              <div className="comment-avatar">
                                {comment.profile_picture_url ? (
                                  <img src={comment.profile_picture_url} alt="Profile" />
                                ) : (
                                  <div className="avatar-placeholder">
                                    {comment.user_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                              <div className="comment-info">
                                <span className="comment-user-name">{comment.user_name}</span>
                                <span className="comment-date">{formatDate(comment.created_at)}</span>
                              </div>
                            </div>
                            <div className="comment-votes">
                              <button 
                                className={`comment-vote-btn upvote ${comment.user_vote === 'upvote' ? 'active' : ''}`}
                                onClick={() => handleCommentVote(comment.id, 'upvote')}
                                disabled={!loggedIn}
                              >
                                <FaThumbsUp />
                                <span>{comment.upvotes || 0}</span>
                              </button>
                              <button 
                                className={`comment-vote-btn downvote ${comment.user_vote === 'downvote' ? 'active' : ''}`}
                                onClick={() => handleCommentVote(comment.id, 'downvote')}
                                disabled={!loggedIn}
                              >
                                <FaThumbsDown />
                                <span>{comment.downvotes || 0}</span>
                              </button>
                            </div>
                          </div>
                          <p className="comment-text">{comment.comment}</p>
                          
                          <div className="comment-actions">
                            <button 
                              className="reply-btn"
                              onClick={() => toggleReplies(comment.id)}
                            >
                              <FaReply />
                              <span>
                                {comment.reply_count > 0 
                                  ? `${comment.reply_count} ${comment.reply_count === 1 ? 'Reply' : 'Replies'}`
                                  : 'Reply'
                                }
                              </span>
                            </button>
                          </div>

                          {expandedReplies[comment.id] && (
                            <div className="replies-section">
                              {replies[comment.id] && replies[comment.id].length > 0 && (
                                <div className="replies-list">
                                  {replies[comment.id].map((reply) => (
                                    <div key={reply.id} className="reply">
                                      <div className="comment-header">
                                        <div className="comment-user">
                                          <div className="comment-avatar">
                                            {reply.profile_picture_url ? (
                                              <img src={reply.profile_picture_url} alt="Profile" />
                                            ) : (
                                              <div className="avatar-placeholder">
                                                {reply.user_name?.charAt(0)?.toUpperCase() || '?'}
                                              </div>
                                            )}
                                          </div>
                                          <div className="comment-info">
                                            <span className="comment-user-name">{reply.user_name}</span>
                                            <span className="comment-date">{formatDate(reply.created_at)}</span>
                                          </div>
                                        </div>
                                        <div className="comment-votes">
                                          <button 
                                            className={`comment-vote-btn upvote ${reply.user_vote === 'upvote' ? 'active' : ''}`}
                                            onClick={() => handleCommentVote(reply.id, 'upvote')}
                                            disabled={!loggedIn}
                                          >
                                            <FaThumbsUp />
                                            <span>{reply.upvotes || 0}</span>
                                          </button>
                                          <button 
                                            className={`comment-vote-btn downvote ${reply.user_vote === 'downvote' ? 'active' : ''}`}
                                            onClick={() => handleCommentVote(reply.id, 'downvote')}
                                            disabled={!loggedIn}
                                          >
                                            <FaThumbsDown />
                                            <span>{reply.downvotes || 0}</span>
                                          </button>
                                        </div>
                                      </div>
                                      <p className="comment-text">{reply.comment}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {loggedIn && (
                                <div className="reply-form">
                                  <textarea
                                    value={replyTexts[comment.id] || ''}
                                    onChange={(e) => setReplyTexts(prev => ({
                                      ...prev,
                                      [comment.id]: e.target.value
                                    }))}
                                    placeholder="Write a reply..."
                                    rows="2"
                                  />
                                  <button 
                                    onClick={() => handleReplySubmit(comment.id)}
                                    disabled={submittingReply[comment.id] || !replyTexts[comment.id]?.trim()}
                                  >
                                    {submittingReply[comment.id] ? 'Posting...' : 'Post Reply'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {review.comments && review.comments.length > 3 && !showAllComments[review.id] && (
                      <button 
                        className="show-all-comments-btn"
                        onClick={() => setShowAllComments(prev => ({ ...prev, [review.id]: true }))}
                      >
                        Show all {review.comments.length} comments
                      </button>
                    )}
                    
                    {review.comments && review.comments.length > 3 && showAllComments[review.id] && (
                      <button 
                        className="show-all-comments-btn"
                        onClick={() => setShowAllComments(prev => ({ ...prev, [review.id]: false }))}
                      >
                        Show top comments
                      </button>
                    )}
                    
                    {loggedIn && (
                      <div className="comment-form">
                        <textarea
                          value={commentTexts[review.id] || ''}
                          onChange={(e) => setCommentTexts(prev => ({
                            ...prev,
                            [review.id]: e.target.value
                          }))}
                          placeholder="Write a comment..."
                          rows="3"
                        />
                        <button 
                          onClick={() => handleCommentSubmit(review.id)}
                          disabled={submittingComment[review.id] || !commentTexts[review.id]?.trim()}
                        >
                          {submittingComment[review.id] ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Browse;