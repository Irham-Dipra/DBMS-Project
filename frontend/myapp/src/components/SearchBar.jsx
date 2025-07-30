import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SearchBar.css';

function SearchBar({ onSearch, showRealTimeResults = false, placeholder = "Search books..." }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);

  // Check if we're already on the search results page
  const isOnSearchPage = location.pathname === '/search';

  // Auto-focus input when on search page
  useEffect(() => {
    if (isOnSearchPage && inputRef.current) {
      // Small delay to ensure the page has fully loaded
      const timer = setTimeout(() => {
        inputRef.current.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOnSearchPage]);

  // Debounce function to limit API calls
  const debounce = useCallback((func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery) => {
      if (searchQuery.trim().length > 0) {
        if (showRealTimeResults && onSearch) {
          // For real-time results (like on SearchResults page)
          onSearch(searchQuery.trim());
        } else {
          // For navigation-based search (like on Home page)
          navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
      }
      setIsLoading(false);
    }, 300), // 300ms delay
    [onSearch, showRealTimeResults, navigate]
  );

  // Handle focus - navigate to search page if not already there
  const handleFocus = () => {
    if (!isOnSearchPage) {
      navigate('/search');
    }
  };

  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Only trigger real-time search if we're on the search page
    if (isOnSearchPage && showRealTimeResults) {
      if (newQuery.trim().length > 0) {
        setIsLoading(true);
        debouncedSearch(newQuery);
      } else {
        setIsLoading(false);
        // Clear results when input is empty
        if (onSearch) {
          onSearch('');
        }
      }
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      setIsLoading(false);
      if (showRealTimeResults && onSearch) {
        onSearch(query.trim());
      } else {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
      setQuery('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Clear query when navigating away from search page
  useEffect(() => {
    if (!isOnSearchPage) {
      setQuery('');
    }
  }, [isOnSearchPage]);

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyPress}
        onFocus={handleFocus}
        className={`search-input ${isLoading ? 'loading' : ''}`}
      />
      <button onClick={handleSearch} className="search-button" disabled={!query.trim()}>
        {isLoading ? '...' : 'Search'}
      </button>
    </div>
  );
}

export default SearchBar;
