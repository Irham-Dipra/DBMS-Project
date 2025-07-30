// src/components/Navbar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaRegUserCircle } from 'react-icons/fa';
import './Navbar.css';
import SearchBar from './SearchBar';
import { FiFilter } from 'react-icons/fi';
import FilterBar from './FilterBar';
import { useFilter } from '../contexts/FilterContext';

function Navbar({ loggedIn, onSearch, showFilters = true, showRealTimeSearch = false, onRealTimeSearch }) {
  const navigate = useNavigate();
  const { filters, setFilters, isFilterOpen, setIsFilterOpen, hasActiveFilters, toggleFilter } = useFilter();

  const handleIconClick = () => {
    navigate(loggedIn ? '/profile' : '/login');
  };

  const defaultSearchHandler = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };
  
  return (
    <>
      <div className="navbar">
        <div className="navbar-logo" onClick={() => navigate('/')}>
          LitLoom
        </div>

        <div className="navbar-center">
          <span onClick={() => navigate('/my-books')}>My Books</span>
          <span onClick={() => navigate('/browse')}>Community</span>
          
        </div>

        <div className="navbar-right">
          <div className="search-bar-wrapper">
            <SearchBar 
              onSearch={showRealTimeSearch ? onRealTimeSearch : (onSearch || defaultSearchHandler)}
              showRealTimeResults={showRealTimeSearch}
              placeholder="Search books, authors, characters..."
            />
          </div>
          {showFilters && (
            <button 
              className={`navbar-filter-btn ${hasActiveFilters() ? 'active' : ''}`} 
              onClick={toggleFilter}
            >
              <FiFilter />
              {hasActiveFilters() && <div className="filter-active-indicator"></div>}
            </button>
          )}
          <button className="navbar-profile-btn" onClick={handleIconClick}>
            {loggedIn ? <FaUser /> : <FaRegUserCircle />}
          </button>
        </div>
      </div>

      {/* Filter dropdown - positioned absolutely below navbar */}
      {showFilters && (
        <div className="navbar-filter-container">
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            isOpen={isFilterOpen}
            setIsOpen={setIsFilterOpen}
          />
        </div>
      )}
    </>
  );
}

export default Navbar;