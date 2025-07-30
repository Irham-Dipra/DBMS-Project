import React, { useEffect, useState, useRef } from 'react';
  import { useParams, useNavigate } from 'react-router-dom';
  import { FaStar, FaCheckCircle, FaPlus, FaCheck, FaBook, FaUser, FaCalendar, FaGlobe, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
  import { BiChevronDown } from 'react-icons/bi';
  import RatingComponent from '../components/RatingComponent';
  import Navbar from '../components/Navbar';
  import BookCard from '../components/BookCard';
  import './IndividualBook.css';
  import Review from '../components/Review';

  function IndividualBook() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRating, setUserRating] = useState(0);
    const [isRating, setIsRating] = useState(false);
    const [currentShelf, setCurrentShelf] = useState(null);
    const [isUpdatingShelf, setIsUpdatingShelf] = useState(false);
    const [showShelfDropdown, setShowShelfDropdown] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);

    const [reviewTitle, setReviewTitle] = useState('');
    const [reviewBody, setReviewBody] = useState('');
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewMessage, setReviewMessage] = useState(null);

    // New state for reviews
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [reviewsError, setReviewsError] = useState(null);

    // Ref for horizontal scrolling
    const otherBooksScrollRef = useRef(null);

    // Load book details + login state
    useEffect(() => {
      // Check login status using both methods for compatibility
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const isLoggedInFlag = localStorage.getItem('loggedIn') === 'true';
      const storedUserId = localStorage.getItem('userId');

      setLoggedIn(!!token || isLoggedInFlag);
      setUserId(storedUserId ? parseInt(storedUserId) : null);

      const fetchBook = async () => {
        try {
          const headers = {
            'Content-Type': 'application/json'
          };

          // Add authorization header if token exists
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          console.log('Fetching book with ID:', id);
          const res = await fetch(`http://localhost:3000/books/${id}`, { headers });
          
          if (!res.ok) {
            const errorData = await res.json();
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `HTTP ${res.status}: Failed to fetch book details`);
          }
          
          const data = await res.json();
          console.log('Book data received:', data);

          setBook(data);
          setUserRating(data.user_rating || 0);
          // Set shelf to 'untracked' if no shelf value or null
          setCurrentShelf(data.shelf || 'untracked');
          // Set review rating to existing user rating
          setReviewRating(data.user_rating || 0);
        } catch (err) {
          console.error('Fetch error:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchBook();
    }, [id]);

    // Fetch reviews for this book
    useEffect(() => {
      const fetchReviews = async () => {
        try {
          setReviewsLoading(true);
          const res = await fetch(`http://localhost:3000/reviews/book/${id}`);
          if (!res.ok) throw new Error('Failed to fetch reviews');
          const data = await res.json();
          setReviews(data);
        } catch (err) {
          setReviewsError(err.message);
        } finally {
          setReviewsLoading(false);
        }
      };

      fetchReviews();
    }, [id]);

    // Handle hash scrolling to write review section
    useEffect(() => {
      if (window.location.hash === '#write-review') {
        const timer = setTimeout(() => {
          const element = document.getElementById('write-review');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 500); // Small delay to ensure the page has loaded
        
        return () => clearTimeout(timer);
      }
    }, [book]);

    // Submit review
    const handleReviewSubmit = async (e) => {
      e.preventDefault();
      setReviewMessage(null);

      if (!reviewTitle.trim() || !reviewBody.trim()) {
        setReviewMessage('❌ Title and body are required.');
        return;
      }

      if (reviewRating === 0) {
        setReviewMessage('❌ Please provide a rating (1-5 stars).');
        return;
      }

      if (!userId) {
        setReviewMessage('❌ User not logged in.');
        return;
      }

      try {
        const currentDateTime = new Date().toISOString();

        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/reviews', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            book_id: parseInt(id),
            title: reviewTitle.trim(),
            body: reviewBody.trim(),
            rating: reviewRating,
            created_at: currentDateTime,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to submit review');
        }

        setReviewMessage('✅ Review submitted successfully!');
        setReviewTitle('');
        setReviewBody('');
        // ✅ Don't reset review rating - keep the existing rating

        // Refresh reviews after successful submission
        const refreshRes = await fetch(`http://localhost:3000/reviews/book/${id}`);
        if (refreshRes.ok) {
          const refreshedReviews = await refreshRes.json();
          setReviews(refreshedReviews);
        }
      } catch (err) {
        setReviewMessage(`❌ ${err.message}`);
      }
    };

    const isLoggedIn = () => {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      return token && token.trim() !== '' && token !== 'null';
    };

    const handleRatingChange = async (rating) => {
      if (!isLoggedIn()) {
        navigate('/login');
        return;
      }

      setIsRating(true);
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        // ✅ First add book to library if untracked
        if (currentShelf === 'untracked') {
          try {
            await fetch('http://localhost:3000/myBooks/books', {
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
            setCurrentShelf('want-to-read');
          } catch (error) {
            // It's okay if this fails (book might already be in library)
            console.log('Book may already be in library');
          }
        }

        // ✅ Use the correct rating endpoint
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
          throw new Error(errorData.message || 'Failed to update rating');
        }

        const rateData = await rateResponse.json();
        
        // ✅ Update both user rating and book's average rating
        setUserRating(rating);
        // ✅ Also update the review rating to sync with the main rating
        setReviewRating(rating);
        
        // Update the book's average rating in the UI
        if (rateData.newAverageRating) {
          setBook(prevBook => ({
            ...prevBook,
            average_rating: rateData.newAverageRating
          }));
        }

        console.log('✅ Rating updated successfully:', rateData);

      } catch (error) {
        console.error('Failed to rate book:', error);
        alert(`Failed to rate book: ${error.message}`);
      } finally {
        setIsRating(false);
      }
    };

    const handleShelfChange = async (shelf) => {
      if (!isLoggedIn()) {
        navigate('/login');
        return;
      }

      setIsUpdatingShelf(true);
      setShowShelfDropdown(false);

      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        if (shelf === 'untracked') {
          // ✅ Remove book from library (untrack it)
          if (currentShelf !== 'untracked') {
            const deleteResponse = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              }
            });

            if (!deleteResponse.ok) {
              throw new Error('Failed to remove book from library');
            }
          }
          setCurrentShelf('untracked');
        } else {
          // ✅ Adding book to a specific shelf
          if (currentShelf === 'untracked') {
            // Add book to library with specified shelf
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

            if (!addResponse.ok) {
              throw new Error('Failed to add book to library');
            }
          } else {
            // Update existing book shelf
            const updateResponse = await fetch(`http://localhost:3000/myBooks/books/${id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                shelf: shelf
              })
            });

            if (!updateResponse.ok) {
              throw new Error('Failed to update book shelf');
            }
          }
          setCurrentShelf(shelf);
        }

      } catch (error) {
        console.error('Failed to update shelf:', error);
        alert('Failed to update shelf. Please try again.');
      } finally {
        setIsUpdatingShelf(false);
      }
    };

    const handleSearch = (searchTerm) => {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    };


    const getShelfDisplayName = (shelf) => {
      switch (shelf) {
        case 'want-to-read': return 'Want to Read';
        case 'currently-reading': return 'Currently Reading';
        case 'read': return 'Read';
        case 'untracked': return 'Untracked';
        default: return 'Untracked';
      }
    };

    const getShelfButtonClass = (shelf) => {
      switch (shelf) {
        case 'read': return 'shelf-read';
        case 'currently-reading': return 'shelf-reading';
        case 'want-to-read': return 'shelf-want';
        case 'untracked': return 'shelf-untracked';
        default: return 'shelf-untracked';
      }
    };

    if (loading) {
      return (
        <div className="book-page">
          <Navbar 
            loggedIn={loggedIn} 
            onSearch={handleSearch}
            showFilters={false}
          />
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading book details...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="book-page">
          <Navbar 
            loggedIn={loggedIn} 
            onSearch={handleSearch}
            showFilters={false}
          />
          <div className="error-container">
            <p>Error: {error}</p>
          </div>
        </div>
      );
    }

    if (!book) {
      return (
        <div className="book-page">
          <Navbar 
            loggedIn={loggedIn} 
            onSearch={handleSearch}
            showFilters={false}
          />
          <div className="error-container">
            <p>No book found.</p>
          </div>
        </div>
      );
    }

    // Calculate stars for rating
    const rating = Math.round(parseFloat(book.average_rating) || 0);
    const formatDate = (dateString) => {
      if (!dateString) return 'Unknown';
      return new Date(dateString).getFullYear();
    };

    const scrollOtherBooks = (direction) => {
      if (otherBooksScrollRef.current) {
        const scrollAmount = 300; // Adjust scroll distance as needed
        const scrollLeft = otherBooksScrollRef.current.scrollLeft;
        const targetScroll = direction === 'left' 
          ? scrollLeft - scrollAmount 
          : scrollLeft + scrollAmount;
        
        otherBooksScrollRef.current.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    };

    // ✅ Add handler for review rating changes
    const handleReviewRatingChange = async (rating) => {
      // Update the review rating state
      setReviewRating(rating);
      
      // Also update the main user rating (call the main rating handler)
      await handleRatingChange(rating);
    };

    return (
      <div className="goodreads-book-page">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
          showFilters={false}
        />

        <div className="book-page-container">
          {/* Main book information section */}
          <div className="book-main-section">
            <div className="book-cover-area">
              <img
                src={book.cover_image || '/default-book-cover.jpg'}
                alt={book.title}
                className="book-cover-image"
              />
              {currentShelf === 'read' && (
                <div className="read-status-badge">
                  <FaCheckCircle /> Read
                </div>
              )}
            </div>

            <div className="book-info-area">
              <div className="book-title-section">
                <h1 className="main-book-title">{book.title}</h1>
                <div className="author-link">
                  by <span 
                    className={`author-name ${book.author_id ? 'clickable' : ''}`}
                    onClick={book.author_id ? () => navigate(`/author/${book.author_id}`) : undefined}
                  >
                    {book.author_name || 'Unknown Author'}
                  </span>
                </div>
              </div>


              {/* User Actions */}
              {loggedIn ? (
                <div className="user-actions-section">
                  <div className="primary-actions">
                    <div className="shelf-selector-modern">
                      <button 
                        className={`shelf-btn ${getShelfButtonClass(currentShelf)} ${isUpdatingShelf ? 'loading' : ''}`}
                        onClick={() => setShowShelfDropdown(!showShelfDropdown)}
                        disabled={isUpdatingShelf}
                      >
                        {isUpdatingShelf ? 'Updating...' : getShelfDisplayName(currentShelf)}
                        <BiChevronDown className="dropdown-icon" />
                      </button>

                      {showShelfDropdown && (
                        <div className="shelf-dropdown-modern">
                          <div className="shelf-option-modern" onClick={() => handleShelfChange('want-to-read')}>
                            Want to Read
                          </div>
                          <div className="shelf-option-modern" onClick={() => handleShelfChange('currently-reading')}>
                            Currently Reading
                          </div>
                          <div className="shelf-option-modern" onClick={() => handleShelfChange('read')}>
                            Read
                          </div>
                          <div className="shelf-option-modern" onClick={() => handleShelfChange('untracked')}>
                            Untracked
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rate-section">
                      <span className="rate-label">Rate this book</span>
                      <RatingComponent
                        currentRating={userRating}
                        onRatingChange={handleRatingChange}
                        isInteractive={true}
                        size="medium"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="login-prompt-section">
                  <button 
                    className="sign-in-button"
                    onClick={() => navigate('/login')}
                  >
                    Sign in to rate and review
                  </button>
                </div>
              )}

              {/* Book Description */}
              <div className="book-description-section">
                <div className="book-description-content">
                  {book.description || 'No description available for this book.'}
                </div>
              </div>

              {/* Book Details */}
              <div className="book-details-modern">
                <div className="detail-row">
                  <span className="detail-key">First published</span>
                  <span className="detail-val">{formatDate(book.publication_date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Genres</span>
                  <div className="genre-tags-container">
                    {Array.isArray(book.genre_details) && book.genre_details.length > 0
                      ? book.genre_details.map((genre, i) => (
                          <span 
                            key={i} 
                            className="genre-tag clickable"
                            onClick={() => navigate(`/genre/${genre.id}`)}
                          >
                            {genre.name}
                          </span>
                        ))
                      : Array.isArray(book.genres) && book.genres.length > 0
                      ? book.genres.map((genreName, i) => (
                          <span 
                            key={i} 
                            className="genre-tag"
                          >
                            {genreName}
                          </span>
                        ))
                      : <span className="genre-tag">Unknown</span>}
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-key">Language</span>
                  <span className="detail-val">{book.language_name || 'Unknown'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Publisher</span>
                  <span className="detail-val">{book.publisher_name || 'Unknown'}</span>
                </div>
                {book.original_country && (
                  <div className="detail-row">
                    <span className="detail-key">Country</span>
                    <span className="detail-val">{book.original_country}</span>
                  </div>
                )}
                {book.pdf_url && (
                  <div className="detail-row">
                    <span className="detail-key">Digital</span>
                    <a href={book.pdf_url} target="_blank" rel="noopener noreferrer" className="pdf-link">
                      View PDF
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Community Rating Section */}
          <div className="community-rating-section">
            <div className="overall-rating">
              <div className="rating-score">{book.average_rating ? parseFloat(book.average_rating).toFixed(2) : 'N/A'}</div>
              <div className="rating-stars-display">
                {[1, 2, 3, 4, 5].map((num) => (
                  <FaStar 
                    key={num} 
                    className={`rating-star ${num <= rating ? 'filled' : 'empty'}`} 
                  />
                ))}
              </div>
              <div className="rating-count">{reviews.length} reviews</div>
            </div>

            {/* Current User Rating Display */}
            {loggedIn && (
              <div className="user-rating-display">
                <div className="user-rating-label">Your Rating</div>
                <div className="user-rating-stars">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <FaStar 
                      key={num} 
                      className={`rating-star ${num <= userRating ? 'filled' : 'empty'}`} 
                    />
                  ))}
                </div>
                <div className="user-rating-text">
                  {userRating > 0 ? `${userRating} star${userRating === 1 ? '' : 's'}` : 'Not rated yet'}
                </div>
              </div>
            )}
            
            <div className="rating-breakdown">
              <div className="rating-bar-item">
                <span className="rating-label">5 stars</span>
                <div className="rating-bar"><div className="rating-fill" style={{width: '40%'}}></div></div>
                <span className="rating-percent">40%</span>
              </div>
              <div className="rating-bar-item">
                <span className="rating-label">4 stars</span>
                <div className="rating-bar"><div className="rating-fill" style={{width: '30%'}}></div></div>
                <span className="rating-percent">30%</span>
              </div>
              <div className="rating-bar-item">
                <span className="rating-label">3 stars</span>
                <div className="rating-bar"><div className="rating-fill" style={{width: '20%'}}></div></div>
                <span className="rating-percent">20%</span>
              </div>
              <div className="rating-bar-item">
                <span className="rating-label">2 stars</span>
                <div className="rating-bar"><div className="rating-fill" style={{width: '7%'}}></div></div>
                <span className="rating-percent">7%</span>
              </div>
              <div className="rating-bar-item">
                <span className="rating-label">1 star</span>
                <div className="rating-bar"><div className="rating-fill" style={{width: '3%'}}></div></div>
                <span className="rating-percent">3%</span>
              </div>
            </div>
          </div>


          {/* About the Author Section */}
          {book.author_bio && (
            <div className="about-author-section">
              <h2 className="section-title">About the Author</h2>
              <div className="author-profile">
                <div className="author-main-info">
                  <div className="author-header">
                    <h3 
                      className={`author-name-large ${book.author_id ? 'clickable' : ''}`}
                      onClick={book.author_id ? () => navigate(`/author/${book.author_id}`) : undefined}
                    >
                      {book.author_name}
                    </h3>
                    {book.author_birth && (
                      <div className="author-details">
                        <span className="author-birth">Born {new Date(book.author_birth).getFullYear()}</span>
                        {book.author_country && <span className="author-country">{book.author_country}</span>}
                      </div>
                    )}
                  </div>
                  <div className="author-biography">
                    {book.author_bio}
                  </div>
                </div>
                
                <div className="author-books-preview">
                  <h4>More Books by {book.author_name}</h4>
                  {book.other_books && book.other_books.length > 0 ? (
                    <div className="author-books-scroll-container">
                      <button 
                        className="scroll-btn left" 
                        onClick={() => scrollOtherBooks('left')}
                        aria-label="Scroll left"
                      >
                        <FaChevronLeft />
                      </button>
                      
                      <div className="author-books-scroll" ref={otherBooksScrollRef}>
                        {book.other_books.map((otherBook) => (
                          <div key={otherBook.id} className="author-book-card-wrapper">
                            <BookCard
                              id={otherBook.id}
                              title={otherBook.title}
                              author={book.author_name}
                              authorId={book.author_id}
                              averageRating={otherBook.average_rating}
                              coverUrl={otherBook.cover_image}
                              userRating={otherBook.user_rating || 0}
                              isRead={otherBook.shelf === 'read'}
                              isInUserLibrary={otherBook.shelf !== null}
                              shelf={otherBook.shelf}
                              isInWishlist={otherBook.shelf === 'want-to-read'}
                            />
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        className="scroll-btn right" 
                        onClick={() => scrollOtherBooks('right')}
                        aria-label="Scroll right"
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                  ) : (
                    <div className="author-books-placeholder">
                      <div className="placeholder-content">
                        <span className="placeholder-icon">📚</span>
                        <span className="placeholder-text">No other books found</span>
                        <div className="placeholder-description">
                          This author has only published this book in our database
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Write Review Section */}
          {loggedIn && userId && (
            <div id="write-review" className="write-review-modern">
              <h2 className="section-title">Write a Review</h2>
              <form onSubmit={handleReviewSubmit} className="review-form-clean">
                <div className="form-field">
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Enter review title"
                    required
                    className="review-title-input"
                  />
                </div>
                <div className="form-field">
                  <label className="rating-label">
                    Rating (Required) 
                    {userRating > 0 && (
                      <span className="existing-rating-note">
                        - Current rating: {userRating} star{userRating === 1 ? '' : 's'}
                      </span>
                    )}
                  </label>
                  <div className="rating-input-section">
                    <RatingComponent
                      currentRating={reviewRating}
                      onRatingChange={handleReviewRatingChange}
                      isInteractive={true}
                      size="medium"
                    />
                    <span className="rating-text">
                      {reviewRating === 0 ? (
                        <span className="rating-required">Please select a rating to write a review</span>
                      ) : (
                        `${reviewRating} star${reviewRating === 1 ? '' : 's'} selected`
                      )}
                    </span>
                  </div>
                </div>
                <div className="form-field">
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="What did you think of this book?"
                    required
                    className="review-body-input"
                    rows="6"
                  />
                </div>
                <button 
                  type="submit" 
                  className={`submit-btn-clean ${reviewRating === 0 ? 'disabled' : ''}`}
                  disabled={reviewRating === 0}
                >
                  {reviewRating === 0 ? 'Rate the book to post review' : 'Post Review'}
                </button>
              </form>

              {reviewMessage && (
                <div className={`review-message ${reviewMessage.startsWith('✅') ? 'success' : 'error'}`}>
                  {reviewMessage}
                </div>
              )}
            </div>
          )}

          {/* Community Reviews Section */}
          <div className="community-reviews-section">
            <h2 className="section-title">Community Reviews</h2>
            
            {reviewsLoading && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading reviews...</span>
              </div>
            )}
            
            {reviewsError && (
              <div className="error-state">
                <span>Error loading reviews: {reviewsError}</span>
              </div>
            )}
            
            {!reviewsLoading && !reviewsError && reviews.length === 0 && (
              <div className="empty-reviews-state">
                <p>No reviews yet. Be the first to review this book!</p>
              </div>
            )}
            
            {!reviewsLoading && !reviewsError && reviews.length > 0 && (
              <div className="goodreads-reviews-list">
                {reviews.map((review) => (
                  <div key={review.id} className="goodreads-review-item">
                    <div className="review-user-section">
                      <div className="user-avatar">
                        {review.profile_picture_url ? (
                          <img src={review.profile_picture_url} alt="Profile" className="avatar-img" />
                        ) : (
                          <div className="avatar-placeholder">
                            {(review.first_name && review.last_name) 
                              ? `${review.first_name.charAt(0)}${review.last_name.charAt(0)}`.toUpperCase()
                              : review.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-name">
                          {(review.first_name && review.last_name) 
                            ? `${review.first_name} ${review.last_name}`
                            : review.user_name}
                        </div>
                        <div className="review-rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FaStar 
                              key={star} 
                              className={`review-star ${star <= review.rating ? 'filled' : 'empty'}`}
                            />
                          ))}
                        </div>
                        <div className="review-date">
                          {new Date(review.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="review-content-section">
                      {review.title && (
                        <h4 className="review-title-display">{review.title}</h4>
                      )}
                      <div className="review-text">
                        {review.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  export default IndividualBook;