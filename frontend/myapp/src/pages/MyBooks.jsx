// src/pages/MyBooks.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { FaEdit, FaRss } from 'react-icons/fa';
import RatingComponent from '../components/RatingComponent';
import './MyBooks.css';

function MyBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShelf, setSelectedShelf] = useState('all');
  const [sortBy, setSortBy] = useState('date_added');
  const [sortOrder, setSortOrder] = useState('desc');
  const [booksPerPage, setBooksPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [shelves, setShelves] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [editingShelf, setEditingShelf] = useState(null); // bookId of book being edited
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchBooks();
    fetchShelves();
    checkAuthStatus();
  }, [selectedShelf, sortBy, sortOrder, currentPage, booksPerPage]);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    setLoggedIn(!!token);
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Use different endpoint for rated books
      const endpoint = selectedShelf === 'rated' 
        ? `http://localhost:3000/myBooks/rated-books?sort=${sortBy}&order=${sortOrder}&page=${currentPage}&limit=${booksPerPage}`
        : `http://localhost:3000/myBooks/books?shelf=${selectedShelf}&sort=${sortBy}&order=${sortOrder}&page=${currentPage}&limit=${booksPerPage}`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBooks(data.books || []);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShelves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/myBooks/shelves', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setShelves(data.shelves || []);
      }
    } catch (error) {
      console.error('Error fetching shelves:', error);
    }
  };

  const handleShelfFilter = (shelf) => {
    setSelectedShelf(shelf);
    setCurrentPage(1);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleBookClick = (bookId) => {
    navigate(`/book/${bookId}`);
  };

  const handleRatingChange = async (bookId, rating) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/myBooks/books/${bookId}/rate`, {
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
        throw new Error('Failed to update rating');
      }

      // Update the book rating in the local state
      setBooks(books.map(book => 
        book.id === bookId ? { ...book, user_rating: rating } : book
      ));

      console.log('✅ Rating updated successfully!');
      
    } catch (error) {
      console.error('Failed to update rating:', error);
      alert('Failed to update rating. Please try again.');
    }
  };

  const handleRatingRemove = async (bookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/myBooks/books/${bookId}/rating`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove rating');
      }

      const result = await response.json();

      // Update the book in local state
      setBooks(books.map(book => 
        book.id === bookId ? { 
          ...book, 
          user_rating: null,
          avg_rating: result.newAverageRating 
        } : book
      ));

      // If we're on the rated books shelf, remove the book from the list
      if (selectedShelf === 'rated') {
        setBooks(books.filter(book => book.id !== bookId));
      }

      // Refresh shelf counts
      fetchShelves();

      console.log('✅ Rating removed successfully!');
      
    } catch (error) {
      console.error('Failed to remove rating:', error);
      alert('Failed to remove rating. Please try again.');
    }
  };

  const handleShelfEdit = (bookId) => {
    setEditingShelf(bookId);
  };

  const handleShelfChange = async (bookId, newShelf) => {
    try {
      const token = localStorage.getItem('token');
      
      if (newShelf === 'untracked') {
        // Delete the book from user's library
        const response = await fetch(`http://localhost:3000/myBooks/books/${bookId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        });

        if (!response.ok) {
          throw new Error('Failed to remove book from library');
        }

        // Immediately remove the book from the local state
        setBooks(books.filter(book => book.id !== bookId));
        
        // Close the edit mode
        setEditingShelf(null);

        // Refresh shelf counts
        fetchShelves();

        console.log('✅ Book removed from library successfully!');
        return;
      }

      // Handle regular shelf updates
      const response = await fetch(`http://localhost:3000/myBooks/books/${bookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          shelf: newShelf
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update shelf');
      }

      // Update the book shelf in the local state
      setBooks(books.map(book => 
        book.id === bookId ? { ...book, shelf: newShelf } : book
      ));

      // Close the edit mode
      setEditingShelf(null);

      // Refresh shelf counts
      fetchShelves();

      console.log('✅ Shelf updated successfully!');
      
    } catch (error) {
      console.error('Failed to update shelf:', error);
      alert('Failed to update shelf. Please try again.');
    }
  };

  const cancelShelfEdit = () => {
    setEditingShelf(null);
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={`star ${i <= rating ? 'filled' : ''}`}>
          ★
        </span>
      );
    }
    return stars;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getShelfCount = (shelfName) => {
    const shelf = shelves.find(s => s.name === shelfName);
    return shelf ? shelf.count : 0;
  };

  // Helper function to get the total count for "All" shelf
  const getAllShelfCount = () => {
    const allShelf = shelves.find(s => s.name === 'all');
    return allShelf ? allShelf.count : 0;
  };

  if (loading) {
    return (
      <div className="mybooks-container">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="loading-spinner">Loading your books...</div>
      </div>
    );
  }

  return (
    <div className="mybooks-container">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />
      
      <div className="mybooks-content">
        <div className="mybooks-header">
          <h1>My Books</h1>
          <div className="mybooks-actions">
            <button className="stats-btn" onClick={() => navigate('/my-books/stats')}>Stats</button>
          </div>
        </div>

        <div className="mybooks-main">
          <div className="mybooks-sidebar">
            <div className="bookshelves-section">
              <h3>
                Bookshelves 
                <button className="edit-shelves-btn">
                  <FaEdit />
                </button>
              </h3>
              <div className="shelf-list">
                <div 
                  className={`shelf-item ${selectedShelf === 'all' ? 'active' : ''}`}
                  onClick={() => handleShelfFilter('all')}
                >
                  <span>All ({getAllShelfCount()})</span>
                </div>
                <div 
                  className={`shelf-item ${selectedShelf === 'want-to-read' ? 'active' : ''}`}
                  onClick={() => handleShelfFilter('want-to-read')}
                >
                  <span>Want to Read ({getShelfCount('want-to-read')})</span>
                </div>
                <div 
                  className={`shelf-item ${selectedShelf === 'currently-reading' ? 'active' : ''}`}
                  onClick={() => handleShelfFilter('currently-reading')}
                >
                  <span>Currently Reading ({getShelfCount('currently-reading')})</span>
                </div>
                <div 
                  className={`shelf-item ${selectedShelf === 'read' ? 'active' : ''}`}
                  onClick={() => handleShelfFilter('read')}
                >
                  <span>Read ({getShelfCount('read')})</span>
                </div>
                <div 
                  className={`shelf-item ${selectedShelf === 'rated' ? 'active' : ''}`}
                  onClick={() => handleShelfFilter('rated')}
                >
                  <span>Rated Books ({getShelfCount('rated')})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mybooks-main-content">
            <div className="books-controls">
              <div className="controls-left">
                <span>per page: </span>
                <select 
                  value={booksPerPage} 
                  onChange={(e) => setBooksPerPage(parseInt(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span> sort: </span>
                <select 
                  value={sortBy} 
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="date_added">Date added</option>
                  <option value="date_read">Date read</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="rating">Rating</option>
                </select>
                <div className="sort-order">
                  <label>
                    <input 
                      type="radio" 
                      value="asc" 
                      checked={sortOrder === 'asc'}
                      onChange={(e) => {
                        setSortOrder(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                    asc.
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      value="desc" 
                      checked={sortOrder === 'desc'}
                      onChange={(e) => {
                        setSortOrder(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                    desc.
                  </label>
                </div>
              </div>
              <div className="controls-right">
                <button className="rss-btn">
                  <FaRss />
                </button>
              </div>
            </div>

            {books.length === 0 ? (
              <div className="no-books-message">
                <p>No books found in your library.</p>
                <button onClick={() => navigate('/')}>Browse Books</button>
              </div>
            ) : (
              <div className="books-table-container">
                <table className="books-table">
                  <thead>
                    <tr>
                      <th>cover</th>
                      <th onClick={() => handleSortChange('title')}>
                        title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSortChange('author')}>
                        author {sortBy === 'author' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>avg rating</th>
                      <th>rating</th>
                      <th>shelves</th>
                      <th>review</th>
                      <th onClick={() => handleSortChange('date_read')}>
                        date read {sortBy === 'date_read' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSortChange('date_added')}>
                        date added {sortBy === 'date_added' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} className="book-row">
                        <td className="book-cover">
                          <img 
                            src={book.cover_url || '/default-book-cover.jpg'} 
                            alt={book.title}
                            onClick={() => handleBookClick(book.id)}
                          />
                        </td>
                        <td className="book-title">
                          <a href="#" onClick={() => handleBookClick(book.id)}>
                            {book.title}
                          </a>
                        </td>
                        <td className="book-author">{book.author}</td>
                        <td className="avg-rating">
                          <div className="rating-stars">
                            {renderStars(Math.round(book.avg_rating || 0))}
                          </div>
                          <span className="rating-text">{book.avg_rating?.toFixed(2) || 'N/A'}</span>
                        </td>
                        <td className="user-rating">
                          <div className="user-rating-container">
                            <RatingComponent
                              currentRating={book.user_rating || 0}
                              onRatingChange={(rating) => handleRatingChange(book.id, rating)}
                              isInteractive={true}
                              size="small"
                            />
                            {book.user_rating && (
                              <button 
                                className="remove-rating-btn"
                                onClick={() => handleRatingRemove(book.id)}
                                title="Remove rating"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="book-shelves">
                          {editingShelf === book.id ? (
                            <div className="shelf-edit-dropdown">
                              <select 
                                value={book.shelf || 'untracked'}
                                onChange={(e) => handleShelfChange(book.id, e.target.value)}
                                autoFocus
                              >
                                <option value="want-to-read">Want to Read</option>
                                <option value="currently-reading">Currently Reading</option>
                                <option value="read">Read</option>
                                <option value="untracked">Untracked</option>
                              </select>
                              <button 
                                className="cancel-edit-btn"
                                onClick={cancelShelfEdit}
                                title="Cancel"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="shelf-display">
                              <span className="shelf-tag">{book.shelf || 'untracked'}</span>
                              <button 
                                className="edit-shelf-btn"
                                onClick={() => handleShelfEdit(book.id)}
                              >
                                [edit]
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="book-review">
                          {book.review ? (
                            <a href={`/review/${book.review_id}`}>View review</a>
                          ) : (
                            <button 
                              className="write-review-btn"
                              onClick={() => navigate(`/book/${book.id}#write-review`)}
                            >
                              Write a review
                            </button>
                          )}
                        </td>
                        <td className="date-read">
                          {book.date_read ? formatDate(book.date_read) : 'not set'}
                        </td>
                        <td className="date-added">
                          {formatDate(book.date_added)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyBooks;