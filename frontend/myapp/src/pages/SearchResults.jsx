import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Homescroll from '../components/Homescroll';
import SearchResultsScroll from '../components/SearchResultsScroll';
import SearchBar from '../components/SearchBar';
import Navbar from '../components/Navbar';
import './SearchResults.css';

function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState(null);

  // Memoize the search parameters to prevent unnecessary re-renders
  const searchParams = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);
    const textQuery = queryParams.get('q') || '';
    const isFiltered = queryParams.get('filtered') === 'true';
    
    return {
      textQuery: textQuery.trim(),
      isFiltered,
      hasValidQuery: isFiltered || textQuery.trim().length > 0,
      queryParams // Include queryParams in the memoized object
    };
  }, [location.search]);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
    setLoggedIn(isLoggedIn);
  }, []);

  const fetchResults = useCallback(async () => {
    if (!searchParams.hasValidQuery) {
      setSections([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query string
      const apiSearchParams = new URLSearchParams();
      
      if (searchParams.isFiltered) {
        // Add all filter parameters
        const filterParams = [
          'language', 'genre', 'author', 'publisher', 'country',
          'pubDateFrom', 'pubDateTo', 'ratingFrom', 'ratingTo'
        ];
        
        filterParams.forEach(param => {
          const value = searchParams.queryParams.get(param);
          if (value && value.trim()) {
            apiSearchParams.append(param, value);
          }
        });
        
        apiSearchParams.append('filtered', 'true');
      } else {
        // Regular text search
        apiSearchParams.append('q', searchParams.textQuery);
      }

      const response = await fetch(`http://localhost:3000/search?${apiSearchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const newSections = [];

        if (searchParams.isFiltered) {
          // For filtered search, only show books
          if (data.data.books && data.data.books.length > 0) {
            newSections.push({ 
              title: `Filtered Results (${data.data.books.length} books found)`, 
              books: data.data.books,
              type: 'books'
            });
          }
        } else {
          // For text search, show books, authors, and characters
          if (data.data.books && data.data.books.length > 0) {
            newSections.push({ 
              title: `Books matching "${searchParams.textQuery}"`, 
              books: data.data.books,
              type: 'books'
            });
          }

          if (data.data.authors && data.data.authors.length > 0) {
            const authorItems = data.data.authors.map(author => ({
              id: `author-${author.id}`,
              title: author.name,
              description: author.bio || 'No biography available',
              author_image: author.author_image || null,
              type: 'author'
            }));
            newSections.push({ 
              title: `Authors matching "${searchParams.textQuery}"`, 
              items: authorItems,
              type: 'authors'
            });
          }

          if (data.data.characters && data.data.characters.length > 0) {
            const characterItems = data.data.characters.map(char => ({
              id: `character-${char.id}`,
              title: char.name,
              description: char.description || 'No description available',
              type: 'character'
            }));
            newSections.push({ 
              title: `Characters matching "${searchParams.textQuery}"`, 
              items: characterItems,
              type: 'characters'
            });
          }
        }

        setSections(newSections);
      } else {
        setSections([]);
        if (!data.success) {
          setError(data.message || 'Search failed');
        }
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
      setError('Failed to fetch search results. Please try again.');
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleSearch = useCallback((q) => {
    if (q && q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }, [navigate]);


  const getPageTitle = () => {
    if (searchParams.isFiltered) {
      return 'Filtered Search Results';
    } else if (searchParams.textQuery) {
      return `Search Results for "${searchParams.textQuery}"`;
    } else {
      return 'Search Results';
    }
  };

  const getActiveFiltersDisplay = () => {
    if (!searchParams.isFiltered) return null;

    const activeFilters = [];
    
    // Check each filter parameter
    const filterLabels = {
      language: 'Languages',
      genre: 'Genres', 
      author: 'Authors',
      publisher: 'Publishers',
      country: 'Countries',
      pubDateFrom: 'Publication Date From',
      pubDateTo: 'Publication Date To',
      ratingFrom: 'Rating From',
      ratingTo: 'Rating To'
    };

    Object.entries(filterLabels).forEach(([param, label]) => {
      const value = searchParams.queryParams.get(param);
      if (value && value.trim()) {
        if (param.includes('Date') || param.includes('rating')) {
          activeFilters.push(`${label}: ${value}`);
        } else {
          // For multi-select filters, show count
          const count = value.split(',').filter(v => v.trim()).length;
          activeFilters.push(`${label}: ${count} selected`);
        }
      }
    });

    if (activeFilters.length === 0) return null;

    return (
      <div className="active-filters">
        <h3>Active Filters:</h3>
        <div className="filter-tags">
          {activeFilters.map((filter, index) => (
            <span key={index} className="filter-tag">{filter}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="home-hero">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />

      <div className="search-results-header">
        <h2 style={{ color: 'white', marginBottom: '1rem' }}>
          {getPageTitle()}
        </h2>
        
        {getActiveFiltersDisplay()}
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', padding: '1rem' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: 'white' }}>Loading...</p>}

      {!loading && !error && sections.length === 0 && searchParams.hasValidQuery && (
        <div className="no-results">
          <p style={{ color: 'white' }}>
            {searchParams.isFiltered 
              ? 'No books match your filter criteria. Try adjusting your filters.'
              : 'No results found for your search query.'
            }
          </p>
        </div>
      )}

      {!loading && sections.map((section, i) => (
        section.type === 'books' ? (
          <Homescroll 
            key={`${section.type}-${i}`} 
            title={section.title} 
            books={section.books} 
          />
        ) : (
          <SearchResultsScroll
            key={`${section.type}-${i}`} 
            title={section.title} 
            items={section.items} 
            type={section.type}
          />
        )
      ))}
    </div>
  );
}

export default SearchResults;