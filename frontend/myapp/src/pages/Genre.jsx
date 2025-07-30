import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import Navbar from '../components/Navbar';
import BookCard from '../components/BookCard';
import './Genre.css';

function Genre() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [genre, setGenre] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  
  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'title');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'asc');
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    fetchGenreData();
    checkAuthStatus();
  }, [id, currentPage, sortBy, sortOrder]);

  // Update URL when filters change - use replace instead of push to avoid history pollution
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (sortBy !== 'title') params.set('sort', sortBy);
    if (sortOrder !== 'asc') params.set('order', sortOrder);
    
    // Use replace instead of normal navigation to avoid creating multiple history entries
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    const currentUrl = window.location.search;
    
    if (newUrl !== currentUrl) {
      window.history.replaceState(null, '', `/genre/${id}${newUrl}`);
    }
  }, [currentPage, sortBy, sortOrder, id]);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    setLoggedIn(!!token);
  };

  const fetchGenreData = async () => {
    try {
      setLoading(currentPage === 1);
      setIsLoadingMore(currentPage > 1);
      
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `http://localhost:3000/genres/${id}?page=${currentPage}&limit=20&sort=${sortBy}&order=${sortOrder}`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('Genre not found');
        } else {
          throw new Error('Failed to fetch genre data');
        }
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setGenre(data.data.genre);
        if (currentPage === 1) {
          setBooks(data.data.books);
        } else {
          setBooks(prev => [...prev, ...data.data.books]);
        }
        setTotalPages(data.data.pagination.totalPages);
        setTotalBooks(data.data.pagination.totalBooks);
      } else {
        setError(data.message || 'Failed to load genre data');
      }
    } catch (error) {
      console.error('Error fetching genre data:', error);
      setError('Unable to load genre information');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSortChange = (newSort) => {
    if (newSort === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSort);
      setSortOrder('asc');
    }
    setCurrentPage(1);
    setBooks([]);
  };

  const loadMoreBooks = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleAuthorClick = (authorId) => {
    navigate(`/author/${authorId}`);
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  const handleBackClick = () => {
    // Try to go back in history, but if there's no history, go to home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="genre-container">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="back-button-container">
          <button className="back-button" onClick={handleBackClick}>
            <FaArrowLeft /> Back
          </button>
        </div>
        <div className="loading-spinner">Loading genre information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="genre-container">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="back-button-container">
          <button className="back-button" onClick={handleBackClick}>
            <FaArrowLeft /> Back
          </button>
        </div>
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBackClick}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="genre-container">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />
      
      <div className="back-button-container">
        <button className="back-button" onClick={handleBackClick}>
          <FaArrowLeft /> Back
        </button>
      </div>
      
      <div className="genre-content">
        <div className="genre-header">
          <div className="genre-info">
            <div className="genre-icon">
              📚
            </div>
            <div className="genre-details">
              <h1 className="genre-name">{genre.name}</h1>
              <div className="genre-stats">
                <span className="books-count">{totalBooks} books</span>
              </div>
            </div>
          </div>
        </div>

        <div className="genre-books-section">
          <div className="section-header">
            <h2>Books in {genre.name}</h2>
            
            <div className="sort-controls">
              <div className="sort-options">
                <button 
                  className={`sort-btn ${sortBy === 'title' ? 'active' : ''}`}
                  onClick={() => handleSortChange('title')}
                >
                  Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                  className={`sort-btn ${sortBy === 'author' ? 'active' : ''}`}
                  onClick={() => handleSortChange('author')}
                >
                  Author {sortBy === 'author' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                  className={`sort-btn ${sortBy === 'publication_date' ? 'active' : ''}`}
                  onClick={() => handleSortChange('publication_date')}
                >
                  Year {sortBy === 'publication_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                  className={`sort-btn ${sortBy === 'average_rating' ? 'active' : ''}`}
                  onClick={() => handleSortChange('average_rating')}
                >
                  Rating {sortBy === 'average_rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>
          
          {books.length === 0 ? (
            <div className="no-books-message">
              <p>No books found for this genre.</p>
            </div>
          ) : (
            <>
              <div className="genre-books-grid">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    id={book.id}
                    title={book.title}
                    author={book.author_name || 'Unknown Author'}
                    authorId={book.author_id}
                    onAuthorClick={handleAuthorClick}
                    averageRating={book.average_rating}
                    coverUrl={book.cover_image}
                    userRating={book.user_rating || 0}
                    isRead={book.shelf === 'read'}
                    isInUserLibrary={book.shelf !== null}
                    shelf={book.shelf}
                    isInWishlist={book.shelf === 'want-to-read'}
                  />
                ))}
              </div>
              
              {currentPage < totalPages && (
                <div className="load-more-section">
                  <button 
                    className={`load-more-btn ${isLoadingMore ? 'loading' : ''}`}
                    onClick={loadMoreBooks}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More Books'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Genre;
