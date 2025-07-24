import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ModeratorBooks.css';

const ModeratorBooks = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    language: '',
    genre: '',
    author: '',
    publisher: '',
    country: '',
    pubDateFrom: '',
    pubDateTo: '',
    ratingFrom: '',
    ratingTo: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalBooks: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [selectedBook, setSelectedBook] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    publication_date: '',
    cover_image: '',
    original_country: '',
    language_id: '',
    publication_house_id: '',
    isbn: '',
    page: '',
    authors: [],
    genres: []
  });

  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    languages: [],
    genres: [],
    authors: [],
    publishers: [],
    countries: []
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBooks();
    fetchFilterOptions();
  }, [pagination.currentPage, searchQuery, filters, sortBy, sortOrder]);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login as moderator.');
        setLoading(false);
        return;
      }
      
      
      const params = new URLSearchParams();
      
      // Add search query
      if (searchQuery) params.append('q', searchQuery);
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      // Add pagination and sorting
      params.append('page', pagination.currentPage);
      params.append('limit', '20');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`http://localhost:3000/moderator/books?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setBooks(data.books);
        setPagination(data.pagination);
      } else {
        const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
        setError(`Failed to fetch books: ${errorMessage}`);
        console.error('Failed to fetch books:', errorMessage);
      }
    } catch (error) {
      setError(`Network error: ${error.message}`);
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/filter-options', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchBooks();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      language: '',
      genre: '',
      author: '',
      publisher: '',
      country: '',
      pubDateFrom: '',
      pubDateTo: '',
      ratingFrom: '',
      ratingTo: ''
    });
    setSearchQuery('');
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleEdit = (book) => {
    setSelectedBook(book);
    setEditFormData({
      title: book.title || '',
      description: book.description || '',
      publication_date: book.publication_date ? book.publication_date.split('T')[0] : '',
      cover_image: book.cover_image || '',
      original_country: book.original_country || '',
      language_id: book.language_id || '',
      publication_house_id: book.publication_house_id || '',
      isbn: book.isbn || '',
      page: book.page || '',
      authors: [], // Will be populated when edit modal opens
      genres: []   // Will be populated when edit modal opens
    });
    setShowEditModal(true);
  };

  const handleDelete = (book) => {
    setSelectedBook(book);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/moderator/books/${selectedBook.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: deleteReason })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Book "${selectedBook.title}" deleted successfully`);
        setShowDeleteModal(false);
        setSelectedBook(null);
        setDeleteReason('');
        fetchBooks(); // Refresh the list
      } else {
        alert('Failed to delete book: ' + data.message);
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Error deleting book');
    }
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const confirmEdit = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/moderator/books/${selectedBook.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Book "${selectedBook.title}" updated successfully`);
        setShowEditModal(false);
        setSelectedBook(null);
        fetchBooks(); // Refresh the list
      } else {
        alert('Failed to update book: ' + data.message);
      }
    } catch (error) {
      console.error('Error updating book:', error);
      alert('Error updating book');
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy === column) {
      return sortOrder === 'ASC' ? '▲' : '▼';
    }
    return '';
  };

  return (
    <div className="moderator-books">
      <div className="moderator-header">
        <button className="back-btn" onClick={() => navigate('/moderator-dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>📚 Book Management</h1>
      </div>

      {/* Search and Filters */}
      <div className="search-filters-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search books by title, description, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn">🔍 Search</button>
        </form>

        <div className="filters-grid">
          <select
            value={filters.language}
            onChange={(e) => handleFilterChange('language', e.target.value)}
          >
            <option value="">All Languages</option>
            {filterOptions.languages?.map(lang => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            )) || []}
          </select>

          <select
            value={filters.genre}
            onChange={(e) => handleFilterChange('genre', e.target.value)}
          >
            <option value="">All Genres</option>
            {filterOptions.genres?.map(genre => (
              <option key={genre.id} value={genre.id}>{genre.name}</option>
            )) || []}
          </select>

          <select
            value={filters.author}
            onChange={(e) => handleFilterChange('author', e.target.value)}
          >
            <option value="">All Authors</option>
            {filterOptions.authors?.map(author => (
              <option key={author.id} value={author.id}>{author.name}</option>
            )) || []}
          </select>

          <select
            value={filters.publisher}
            onChange={(e) => handleFilterChange('publisher', e.target.value)}
          >
            <option value="">All Publishers</option>
            {filterOptions.publishers?.map(pub => (
              <option key={pub.id} value={pub.id}>{pub.name}</option>
            )) || []}
          </select>

          <input
            type="number"
            placeholder="Min Rating"
            value={filters.ratingFrom}
            onChange={(e) => handleFilterChange('ratingFrom', e.target.value)}
            step="0.1"
            min="0"
            max="5"
          />

          <input
            type="number"
            placeholder="Max Rating"
            value={filters.ratingTo}
            onChange={(e) => handleFilterChange('ratingTo', e.target.value)}
            step="0.1"
            min="0"
            max="5"
          />

          <button onClick={clearFilters} className="clear-filters-btn">
            🗑️ Clear Filters
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            🔄 Retry
          </button>
        </div>
      )}

      {/* Results Summary */}
      {!error && (
        <div className="results-summary">
          <p>
            Showing {books.length} of {pagination.totalBooks} books 
            (Page {pagination.currentPage} of {pagination.totalPages})
          </p>
        </div>
      )}

      {/* Books Table */}
      <div className="books-table-container">
        {loading ? (
          <div className="loading">Loading books...</div>
        ) : error ? (
          <div className="error-placeholder">
            <p>Unable to load books. Please check your connection and try again.</p>
          </div>
        ) : (
          <table className="books-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('title')}>
                  Title {getSortIcon('title')}
                </th>
                <th onClick={() => handleSort('authors')}>
                  Authors {getSortIcon('authors')}
                </th>
                <th onClick={() => handleSort('average_rating')}>
                  Rating {getSortIcon('average_rating')}
                </th>
                <th onClick={() => handleSort('publication_date')}>
                  Published {getSortIcon('publication_date')}
                </th>
                <th onClick={() => handleSort('created_at')}>
                  Added {getSortIcon('created_at')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map(book => (
                <tr key={book.id}>
                  <td>
                    <div className="book-title-cell">
                      <img 
                        src={book.cover_image || '/default-book-cover.png'} 
                        alt={book.title}
                        className="book-cover-small"
                      />
                      <div>
                        <div className="book-title">{book.title}</div>
                        <div className="book-isbn">ISBN: {book.isbn || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{book.authors || 'Unknown'}</td>
                  <td>
                    <div className="rating-cell">
                      <span className="rating-value">
                        {book.average_rating && !isNaN(parseFloat(book.average_rating)) ? parseFloat(book.average_rating).toFixed(1) : 'N/A'}
                      </span>
                      <span className="rating-count">
                        ({book.rating_count || 0} ratings)
                      </span>
                    </div>
                  </td>
                  <td>
                    {book.publication_date ? 
                      new Date(book.publication_date).getFullYear() : 
                      'N/A'
                    }
                  </td>
                  <td>
                    {new Date(book.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleEdit(book)}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(book)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button 
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={!pagination.hasPrevPage}
        >
          ← Previous
        </button>
        
        <span>
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        
        <button 
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={!pagination.hasNextPage}
        >
          Next →
        </button>
      </div>

      {/* Edit Book Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>✏️ Edit Book</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => handleEditFormChange('title', e.target.value)}
                  placeholder="Book title"
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => handleEditFormChange('description', e.target.value)}
                  placeholder="Book description"
                  rows="4"
                />
              </div>
              
              <div className="form-group">
                <label>Publication Date:</label>
                <input
                  type="date"
                  value={editFormData.publication_date}
                  onChange={(e) => handleEditFormChange('publication_date', e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Cover Image URL:</label>
                <input
                  type="text"
                  value={editFormData.cover_image}
                  onChange={(e) => handleEditFormChange('cover_image', e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              
              <div className="form-group">
                <label>Original Country:</label>
                <input
                  type="text"
                  value={editFormData.original_country}
                  onChange={(e) => handleEditFormChange('original_country', e.target.value)}
                  placeholder="Country of origin"
                />
              </div>
              
              <div className="form-group">
                <label>Language:</label>
                <select
                  value={editFormData.language_id}
                  onChange={(e) => handleEditFormChange('language_id', e.target.value)}
                >
                  <option value="">Select Language</option>
                  {filterOptions.languages?.map(lang => (
                    <option key={lang.id} value={lang.id}>{lang.name}</option>
                  )) || []}
                </select>
              </div>
              
              <div className="form-group">
                <label>Publisher:</label>
                <select
                  value={editFormData.publication_house_id}
                  onChange={(e) => handleEditFormChange('publication_house_id', e.target.value)}
                >
                  <option value="">Select Publisher</option>
                  {filterOptions.publishers?.map(pub => (
                    <option key={pub.id} value={pub.id}>{pub.name}</option>
                  )) || []}
                </select>
              </div>
              
              <div className="form-group">
                <label>ISBN:</label>
                <input
                  type="text"
                  value={editFormData.isbn}
                  onChange={(e) => handleEditFormChange('isbn', e.target.value)}
                  placeholder="ISBN number"
                />
              </div>
              
              <div className="form-group">
                <label>Pages:</label>
                <input
                  type="number"
                  value={editFormData.page}
                  onChange={(e) => handleEditFormChange('page', e.target.value)}
                  placeholder="Number of pages"
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button 
                onClick={() => setShowEditModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={confirmEdit}
                className="confirm-edit-btn"
              >
                Update Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>⚠️ Confirm Book Deletion</h2>
            <p>Are you sure you want to delete <strong>"{selectedBook?.title}"</strong>?</p>
            <div className="warning-text">
              <p>This action will:</p>
              <ul>
                <li>✅ Preserve user reviews, ratings, and reading history</li>
                <li>🗑️ Remove the book from search results</li>
                <li>📊 Log all data for recovery if needed</li>
              </ul>
            </div>
            
            <div className="form-group">
              <label>Deletion Reason (optional):</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Why is this book being deleted?"
                rows="3"
              />
            </div>

            <div className="modal-buttons">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="confirm-delete-btn"
              >
                Delete Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModeratorBooks;