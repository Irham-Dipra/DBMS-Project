// frontend/src/pages/AddBook.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddBook.css';

const AddBook = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  
  // Data states
  const [genres, setGenres] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [publications, setPublications] = useState([]);
  const [authors, setAuthors] = useState([]);

  // Search states
  const [genreSearch, setGenreSearch] = useState('');
  const [languageSearch, setLanguageSearch] = useState('');
  const [publicationSearch, setPublicationSearch] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');

  // Selection states
  const [selectedGenreId, setSelectedGenreId] = useState('');
  const [selectedLanguageId, setSelectedLanguageId] = useState('');
  const [selectedPublicationId, setSelectedPublicationId] = useState('');
  const [selectedAuthorIds, setSelectedAuthorIds] = useState([]);

  // New item states
  const [newGenre, setNewGenre] = useState('');
  const [newLanguage, setNewLanguage] = useState({ name: '', iso_code: '' });
  const [newPublication, setNewPublication] = useState({ name: '' });
  const [newAuthor, setNewAuthor] = useState({ name: '', bio: '' });

  // Book info state
  const [bookInfo, setBookInfo] = useState({
    title: '',
    description: '',
    publication_date: '',
    cover_image: '',
    original_country: '',
    page: ''
  });

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState(null);

  // Get user ID from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token payload:', payload); // Debug log
        
        // Check all possible user ID fields
        const userId = payload.id || payload.userId || payload.user_id || payload.sub;
        console.log('Extracted userId:', userId); // Debug log
        
        if (userId) {
          setUserId(userId);
        } else {
          console.error('No user ID found in token payload');
          setError('Invalid authentication token');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error parsing token:', error);
        setError('Invalid authentication token');
        navigate('/login');
      }
    } else {
      setError('No authentication token found');
      navigate('/login');
    }
  }, [navigate]);

  // Test server connection first
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing server connection...');
        const response = await fetch('http://localhost:3000/addBook/genres', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Server connection test - Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Server connection successful, genres:', data);
        } else {
          console.error('Server connection failed:', response.statusText);
          setError('Unable to connect to server. Please check if the backend is running.');
        }
      } catch (error) {
        console.error('Server connection test failed:', error);
        setError('Unable to connect to server. Please check if the backend is running on port 3000.');
      }
    };

    testConnection();
  }, []);

  // Start session when component mounts
  useEffect(() => {
    if (userId) {
      startSession();
    }
  }, [userId]);

  const startSession = async () => {
    if (!userId) {
      setError('User ID not available');
      return;
    }

    try {
      console.log('Starting session for user:', userId); // Debug log
      
      const response = await fetch('http://localhost:3000/addBook/start-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
      
      console.log('Response status:', response.status); // Debug log
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Session start response:', data); // Debug log
      
      if (data.success) {
        setSessionId(data.sessionId);
        console.log('Session started successfully:', data.sessionId);
      } else {
        setError('Failed to start session: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setError('Error starting session. Please check your connection and try again.');
    }
  };

  const rollbackSession = async () => {
    if (!sessionId) return;
    try {
      await fetch('http://localhost:3000/addBook/rollback-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch (error) {
      console.error('Error rolling back session:', error);
    }
  };

  const handleBackToDashboard = async () => {
    await rollbackSession();
    navigate('/moderator-dashboard');
  };

  const handleGoHome = async () => {
    await rollbackSession();
    navigate('/');
  };

  // Fetch data functions with better error handling
  const fetchGenres = useCallback(async (search = '') => {
    try {
      const url = search ? 
        `http://localhost:3000/addBook/genres?search=${encodeURIComponent(search)}` :
        'http://localhost:3000/addBook/genres';
      
      console.log('Fetching genres from:', url); // Debug log
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Genres fetched:', data); // Debug log
      
      if (Array.isArray(data)) {
        setGenres(data);
      } else if (data.success && Array.isArray(data.genres)) {
        setGenres(data.genres);
      } else {
        console.error('Unexpected response format:', data);
        setError('Error loading genres');
      }
    } catch (error) {
      console.error('Error fetching genres:', error);
      setError('Error loading genres. Please refresh and try again.');
    }
  }, []);

  const fetchLanguages = useCallback(async (search = '') => {
    try {
      const url = search ? 
        `http://localhost:3000/addBook/languages?search=${encodeURIComponent(search)}` :
        'http://localhost:3000/addBook/languages';
      const response = await fetch(url);
      const data = await response.json();
      setLanguages(data);
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  }, []);

  const fetchPublications = useCallback(async (search = '') => {
    try {
      const url = search ? 
        `http://localhost:3000/addBook/publication_houses?search=${encodeURIComponent(search)}` :
        'http://localhost:3000/addBook/publication_houses';
      const response = await fetch(url);
      const data = await response.json();
      setPublications(data);
    } catch (error) {
      console.error('Error fetching publications:', error);
    }
  }, []);

  const fetchAuthors = useCallback(async (search = '') => {
    try {
      const url = search ? 
        `http://localhost:3000/addBook/authors?search=${encodeURIComponent(search)}` :
        'http://localhost:3000/addBook/authors';
      const response = await fetch(url);
      const data = await response.json();
      setAuthors(data);
    } catch (error) {
      console.error('Error fetching authors:', error);
    }
  }, []);

  // Load initial data when session is ready
  useEffect(() => {
    if (sessionId) {
      console.log('Session ready, loading initial data...');
      fetchGenres();
      fetchLanguages();
      fetchPublications();
      fetchAuthors();
    }
  }, [sessionId, fetchGenres, fetchLanguages, fetchPublications, fetchAuthors]);

  // Search effect handlers
  useEffect(() => {
    const timer = setTimeout(() => fetchGenres(genreSearch), 300);
    return () => clearTimeout(timer);
  }, [genreSearch, fetchGenres]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLanguages(languageSearch), 300);
    return () => clearTimeout(timer);
  }, [languageSearch, fetchLanguages]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPublications(publicationSearch), 300);
    return () => clearTimeout(timer);
  }, [publicationSearch, fetchPublications]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAuthors(authorSearch), 300);
    return () => clearTimeout(timer);
  }, [authorSearch, fetchAuthors]);

  const addGenre = async () => {
    if (!newGenre.trim() || !sessionId) {
      console.log('Missing data:', { newGenre: newGenre.trim(), sessionId });
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      console.log('Adding genre:', { name: newGenre, sessionId }); // Debug log
      const response = await fetch('http://localhost:3000/addBook/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGenre, sessionId })
      });
      
      console.log('Response status:', response.status); // Debug log
      const data = await response.json();
      console.log('Response data:', data); // Debug log
      
      if (data.success) {
        // Add new genre to the list
        setGenres([...genres, data.genre]);
        
        // ALWAYS select the newly added genre (replacing any previous selection)
        setSelectedGenreId(data.genre.id);
        setNewGenre('');
        setSuccess('Genre added successfully!');
        
        // Auto-navigate to next step after successful addition
        setTimeout(() => {
          setStep(2);
          setSuccess('');
        }, 1000);
      } else {
        setError(data.message || 'Failed to add genre');
      }
    } catch (error) {
      console.error('Error adding genre:', error);
      setError('Error adding genre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addLanguage = async () => {
    if (!newLanguage.name.trim() || !newLanguage.iso_code.trim() || !sessionId) return;
    setLoading(true);
    setError('');
    
    try {
      console.log('Adding language:', { ...newLanguage, sessionId }); // Debug log
      const response = await fetch('http://localhost:3000/addBook/languages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newLanguage, sessionId })
      });
      const data = await response.json();
      
      if (data.success) {
        // Add new language to the list
        setLanguages([...languages, data.language]);
        
        // ALWAYS select the newly added language (replacing any previous selection)
        setSelectedLanguageId(data.language.id);
        setNewLanguage({ name: '', iso_code: '' });
        setSuccess('Language added successfully!');
        
        setTimeout(() => {
          setStep(3);
          setSuccess('');
        }, 1000);
      } else {
        setError(data.message || 'Failed to add language');
      }
    } catch (error) {
      console.error('Error adding language:', error);
      setError('Error adding language: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addPublication = async () => {
    if (!newPublication.name.trim() || !sessionId) return;
    setLoading(true);
    setError('');
    
    try {
      console.log('Adding publication:', { ...newPublication, sessionId }); // Debug log
      const response = await fetch('http://localhost:3000/addBook/publication_houses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPublication, sessionId })
      });
      const data = await response.json();
      
      if (data.success) {
        // Add new publication to the list
        setPublications([...publications, data.publication_house]);
        
        // ALWAYS select the newly added publication (replacing any previous selection)
        setSelectedPublicationId(data.publication_house.id);
        setNewPublication({ name: '' });
        setSuccess('Publication house added successfully!');
        
        setTimeout(() => {
          setStep(4);
          setSuccess('');
        }, 1000);
      } else {
        setError(data.message || 'Failed to add publication house');
      }
    } catch (error) {
      console.error('Error adding publication house:', error);
      setError('Error adding publication house: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addAuthor = async () => {
    if (!newAuthor.name.trim() || !sessionId) return;
    setLoading(true);
    setError('');
    
    try {
      console.log('Adding author:', { ...newAuthor, sessionId }); // Debug log
      const response = await fetch('http://localhost:3000/addBook/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAuthor, sessionId })
      });
      const data = await response.json();
      
      if (data.success) {
        // Add new author to the list
        setAuthors([...authors, data.author]);
        
        // ALWAYS select ONLY the newly added author (replacing ALL previous selections)
        setSelectedAuthorIds([data.author.id.toString()]);
        setNewAuthor({ name: '', bio: '' });
        setSuccess('Author added successfully!');
        
        // Auto-navigate to next step after successful addition
        setTimeout(() => {
          setStep(5);
          setSuccess('');
        }, 1000);
      } else {
        setError(data.message || 'Failed to add author');
      }
    } catch (error) {
      console.error('Error adding author:', error);
      setError('Error adding author: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitBook = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    
    const payload = {
      ...bookInfo,
      genre_id: selectedGenreId,
      language_id: selectedLanguageId,
      publication_house_id: selectedPublicationId,
      author_ids: selectedAuthorIds,
      added_by: userId,
      sessionId
    };
    
    try {
      const response = await fetch('http://localhost:3000/addBook/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Book added successfully with ID: ${data.book_id}`);
        setTimeout(() => {
          navigate('/moderator-dashboard');
        }, 2000);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Error submitting book');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => {
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="step-indicator">
        {steps.map((stepNum) => (
          <div
            key={stepNum}
            className={`step-dot ${stepNum === step ? 'active' : stepNum < step ? 'completed' : ''}`}
          />
        ))}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Select Genre</h2>
            
            {/* Show selected genre */}
            {selectedGenreId && (
              <div className="selected-item">
                <h3>Selected Genre:</h3>
                <div className="selected-display">
                  {genres.find(g => g.id == selectedGenreId)?.name || 'Loading...'}
                </div>
              </div>
            )}
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search genres..."
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
              />
            </div>

            <div className="selection-section">
              <label>Choose from existing genres:</label>
              <div className="items-grid">
                {genres.map(genre => (
                  <div
                    key={genre.id}
                    className={`item-card ${selectedGenreId == genre.id ? 'selected' : ''}`}
                    onClick={() => setSelectedGenreId(genre.id)}
                  >
                    <h4>{genre.name}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="add-item-section">
              <h3>Add New Genre</h3>
              <input 
                type='text' 
                value={newGenre} 
                onChange={e => setNewGenre(e.target.value)} 
                placeholder='Enter new genre name' 
                onKeyPress={(e) => e.key === 'Enter' && addGenre()}
              />
              <button 
                className="add-button" 
                onClick={addGenre}
                disabled={loading || !newGenre.trim()}
              >
                {loading && <span className="loading-spinner"></span>}
                Add Genre
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nav-buttons">
              <div></div>
              <button 
                className="nav-button primary" 
                disabled={!selectedGenreId} 
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="step-content">
            <h2>Select Language</h2>
            
            {/* Show selected language */}
            {selectedLanguageId && (
              <div className="selected-item">
                <h3>Selected Language:</h3>
                <div className="selected-display">
                  {(() => {
                    const lang = languages.find(l => l.id == selectedLanguageId);
                    return lang ? `${lang.name} (${lang.iso_code})` : 'Loading...';
                  })()}
                </div>
              </div>
            )}
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search languages..."
                value={languageSearch}
                onChange={(e) => setLanguageSearch(e.target.value)}
              />
            </div>

            <div className="selection-section">
              <label>Choose from existing languages:</label>
              <div className="items-grid">
                {languages.map(language => (
                  <div
                    key={language.id}
                    className={`item-card ${selectedLanguageId == language.id ? 'selected' : ''}`}
                    onClick={() => setSelectedLanguageId(language.id)}
                  >
                    <h4>{language.name} ({language.iso_code})</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="add-item-section">
              <h3>Add New Language</h3>
              <input 
                type='text' 
                placeholder='Language Name (e.g., English, French)' 
                value={newLanguage.name} 
                onChange={e => setNewLanguage({ ...newLanguage, name: e.target.value })} 
              />
              <input 
                type='text' 
                placeholder='ISO Code (e.g., EN, FR, ES)' 
                value={newLanguage.iso_code} 
                onChange={e => setNewLanguage({ ...newLanguage, iso_code: e.target.value.toUpperCase() })} 
                maxLength={10}
              />
              <button 
                className="add-button" 
                onClick={() => {
                  if (!newLanguage.name.trim()) {
                    setError('Language name is required');
                    return;
                  }
                  if (!newLanguage.iso_code.trim()) {
                    setError('ISO code is required (e.g., EN, FR, ES)');
                    return;
                  }
                  setError('');
                  addLanguage();
                }}
                disabled={loading}
              >
                {loading && <span className="loading-spinner"></span>}
                Add Language
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(1)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedLanguageId} 
                onClick={() => setStep(3)}
              >
                Next
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h2>Select Publication House</h2>
            
            {/* Show selected publication house */}
            {selectedPublicationId && (
              <div className="selected-item">
                <h3>Selected Publication House:</h3>
                <div className="selected-display">
                  {publications.find(p => p.id == selectedPublicationId)?.name || 'Loading...'}
                </div>
              </div>
            )}
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search publication houses..."
                value={publicationSearch}
                onChange={(e) => setPublicationSearch(e.target.value)}
              />
            </div>

            <div className="selection-section">
              <label>Choose from existing publication houses:</label>
              <div className="items-grid">
                {publications.map(pub => (
                  <div
                    key={pub.id}
                    className={`item-card ${selectedPublicationId == pub.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPublicationId(pub.id)}
                  >
                    <h4>{pub.name}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="add-item-section">
              <h3>Add New Publication House</h3>
              <input 
                type='text' 
                placeholder='Publication House Name' 
                value={newPublication.name} 
                onChange={e => setNewPublication({ ...newPublication, name: e.target.value })} 
                onKeyPress={(e) => e.key === 'Enter' && addPublication()}
              />
              <button 
                className="add-button" 
                onClick={addPublication}
                disabled={loading || !newPublication.name.trim()}
              >
                {loading && <span className="loading-spinner"></span>}
                Add Publication House
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(2)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedPublicationId} 
                onClick={() => setStep(4)}
              >
                Next
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h2>Select Author(s)</h2>
            
            {/* Show selected authors */}
            {selectedAuthorIds.length > 0 && (
              <div className="selected-item">
                <h3>Selected Author{selectedAuthorIds.length > 1 ? 's' : ''}:</h3>
                <div className="selected-authors">
                  {selectedAuthorIds.map(authorId => {
                    const author = authors.find(a => a.id.toString() === authorId);
                    return (
                      <div key={authorId} className="selected-author-tag">
                        {author?.name || 'Loading...'}
                        <button 
                          className="remove-author"
                          onClick={() => setSelectedAuthorIds(selectedAuthorIds.filter(id => id !== authorId))}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search authors..."
                value={authorSearch}
                onChange={(e) => setAuthorSearch(e.target.value)}
              />
            </div>

            <div className="selection-section">
              <label>Choose from existing authors (click multiple):</label>
              <div className="items-grid">
                {authors.map(author => (
                  <div
                    key={author.id}
                    className={`item-card ${selectedAuthorIds.includes(author.id.toString()) ? 'selected' : ''}`}
                    onClick={() => {
                      const authorId = author.id.toString();
                      if (selectedAuthorIds.includes(authorId)) {
                        setSelectedAuthorIds(selectedAuthorIds.filter(id => id !== authorId));
                      } else {
                        setSelectedAuthorIds([...selectedAuthorIds, authorId]);
                      }
                    }}
                  >
                    <h4>{author.name}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="add-item-section">
              <h3>Add New Author</h3>
              <input 
                type='text' 
                placeholder='Author Name' 
                value={newAuthor.name} 
                onChange={e => setNewAuthor({ ...newAuthor, name: e.target.value })} 
              />
              <textarea 
                placeholder='Biography (optional)' 
                value={newAuthor.bio} 
                onChange={e => setNewAuthor({ ...newAuthor, bio: e.target.value })} 
              />
              <button 
                className="add-button" 
                onClick={addAuthor}
                disabled={loading || !newAuthor.name.trim()}
              >
                {loading && <span className="loading-spinner"></span>}
                Add Author
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(3)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedAuthorIds.length} 
                onClick={() => setStep(5)}
              >
                Next
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <h2>Enter Book Information</h2>
            
            {/* Show all selected items summary */}
            <div className="selection-summary">
              <h3>Selected Information:</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <strong>Genre:</strong> {genres.find(g => g.id == selectedGenreId)?.name || 'Not selected'}
                </div>
                <div className="summary-item">
                  <strong>Language:</strong> {(() => {
                    const lang = languages.find(l => l.id == selectedLanguageId);
                    return lang ? `${lang.name} (${lang.iso_code})` : 'Not selected';
                  })()}
                </div>
                <div className="summary-item">
                  <strong>Publisher:</strong> {publications.find(p => p.id == selectedPublicationId)?.name || 'Not selected'}
                </div>
                <div className="summary-item">
                  <strong>Author(s):</strong> {selectedAuthorIds.length > 0 ? 
                    selectedAuthorIds.map(id => authors.find(a => a.id.toString() === id)?.name).join(', ') : 
                    'Not selected'
                  }
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label>Book Title:</label>
              <input 
                type='text' 
                placeholder='Enter book title' 
                value={bookInfo.title} 
                onChange={e => setBookInfo({ ...bookInfo, title: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea 
                placeholder='Enter book description' 
                value={bookInfo.description} 
                onChange={e => setBookInfo({ ...bookInfo, description: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Publication Date:</label>
              <input 
                type='date' 
                value={bookInfo.publication_date} 
                onChange={e => setBookInfo({ ...bookInfo, publication_date: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Cover Image URL:</label>
              <input 
                type='text' 
                placeholder='Enter cover image URL' 
                value={bookInfo.cover_image} 
                onChange={e => setBookInfo({ ...bookInfo, cover_image: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Original Country:</label>
              <input 
                type='text' 
                placeholder='Enter original country' 
                value={bookInfo.original_country} 
                onChange={e => setBookInfo({ ...bookInfo, original_country: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Number of Pages:</label>
              <input 
                type='number' 
                placeholder='Enter number of pages' 
                value={bookInfo.page} 
                onChange={e => setBookInfo({ ...bookInfo, page: e.target.value })} 
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(4)}>Back</button>
              <button 
                className="nav-button success" 
                onClick={submitBook}
                disabled={loading || !bookInfo.title.trim()}
              >
                {loading && <span className="loading-spinner"></span>}
                Submit Book
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="add-book-page">
      <div className="add-book-header">
        <div className="header-left">
          <div className="litloom-logo" onClick={handleGoHome}>
            LitLoom
          </div>
          <h1 className="page-title">Add Book</h1>
        </div>
        <button className="back-btn" onClick={handleBackToDashboard}>
          ← Back to Dashboard
        </button>
      </div>
      
      <StepIndicator />
      {renderStep()}
    </div>
  );
};

export default AddBook;