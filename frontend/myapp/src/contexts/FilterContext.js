// src/contexts/FilterContext.js
import React, { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};

export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    language: [],
    genre: [],
    author: [],
    publisher: [],
    country: [],
    pubDateRange: [1800, 2025],
    ratingRange: [0, 5]
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      filters.language.length > 0 ||
      filters.genre.length > 0 ||
      filters.author.length > 0 ||
      filters.publisher.length > 0 ||
      filters.country.length > 0 ||
      (filters.pubDateRange && (filters.pubDateRange[0] !== 1800 || filters.pubDateRange[1] !== 2025)) ||
      (filters.ratingRange && (filters.ratingRange[0] !== 0 || filters.ratingRange[1] !== 5))
    );
  };

  const resetFilters = () => {
    setFilters({
      language: [],
      genre: [],
      author: [],
      publisher: [],
      country: [],
      pubDateRange: [1800, 2025],
      ratingRange: [0, 5]
    });
  };

  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const value = {
    filters,
    setFilters,
    isFilterOpen,
    setIsFilterOpen,
    hasActiveFilters,
    resetFilters,
    toggleFilter
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};