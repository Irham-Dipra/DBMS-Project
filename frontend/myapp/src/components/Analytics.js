// src/components/Analytics.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import UserAnalytics from './UserAnalytics';
import UserProfileModal from './UserProfileModal';
import Navbar from './Navbar';
import { FilterProvider } from '../contexts/FilterContext';
import './Analytics.css';

const Analytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('genre');
  const [chartType, setChartType] = useState('bar');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [displayType, setDisplayType] = useState('top-rated');
  const [minBooks, setMinBooks] = useState('');
  const [minRating, setMinRating] = useState('');
  const [limit, setLimit] = useState('10');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    genreRatings: [],
    authorRatings: [],
    publisherRatings: [],
    contentGaps: [],
    bookTrends: [],
    availableBooks: [],
    availableAuthors: [],
    availablePublishers: []
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  useEffect(() => {
    // Reset displayType when switching to content gaps
    if (activeTab === 'content-gaps' && displayType === 'top-rated') {
      setDisplayType('all');
    }
    fetchAnalyticsData();
  }, [activeTab, startDate, endDate, selectedItem, displayType, minBooks, minRating, limit]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedItem) {
        if (activeTab === 'author') params.append('authorId', selectedItem);
        if (activeTab === 'publisher') params.append('publisherId', selectedItem);
        if (activeTab === 'book') params.append('bookId', selectedItem);
      }
      
      // Add filters for genre, author, and publisher
      if (['genre', 'author', 'publisher'].includes(activeTab)) {
        if (displayType) params.append('displayType', displayType);
        if (minBooks) params.append('minBooks', minBooks);
        if (minRating) params.append('minRating', minRating);
        if (limit) params.append('limit', limit);
      }
      
      // Add filters for content gaps
      if (activeTab === 'content-gaps') {
        // Always use default limit for content gaps
        params.append('limit', '20');
        console.log('Content gaps params:', params.toString());
      }

      let endpoint = '';
      switch (activeTab) {
        case 'genre':
          endpoint = '/analytics/genre-ratings';
          break;
        case 'author':
          endpoint = '/analytics/author-ratings';
          break;
        case 'publisher':
          endpoint = '/analytics/publisher-ratings';
          break;
        case 'content-gaps':
          endpoint = '/analytics/content-gaps';
          break;
        case 'book':
          endpoint = '/analytics/book-trends';
          break;
      }

      const response = await fetch(`http://localhost:3000${endpoint}?${params}`, { headers });
      const data = await response.json();

      // Debug logging for content gaps
      if (activeTab === 'content-gaps') {
        console.log('Content gaps response:', data);
        console.log('Content gaps data:', data.data);
      }

      if (data.success) {
        const keyName = `${activeTab}${activeTab === 'book' ? 'Trends' : activeTab === 'content-gaps' ? 'Gaps' : 'Ratings'}`;
        console.log('Setting analytics data key:', keyName);
        console.log('Setting analytics data value:', data.data);
        
        setAnalyticsData(prev => ({
          ...prev,
          [keyName]: data.data
        }));
      } else {
        console.error('Failed to fetch analytics data:', data.message);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`http://localhost:3000/analytics/options?type=${type}`, { headers });
      const data = await response.json();

      if (data.success) {
        setAnalyticsData(prev => ({
          ...prev,
          [`available${type.charAt(0).toUpperCase() + type.slice(1)}`]: data[type]
        }));
      }
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'book' && analyticsData.availableBooks.length === 0) {
      fetchOptions('books');
    } else if (activeTab === 'author' && analyticsData.availableAuthors.length === 0) {
      fetchOptions('authors');
    } else if (activeTab === 'publisher' && analyticsData.availablePublishers.length === 0) {
      fetchOptions('publishers');
    }
  }, [activeTab, analyticsData]);

  const handleBack = () => navigate('/moderator-dashboard');

  const getCurrentData = () => {
    switch (activeTab) {
      case 'genre': return analyticsData.genreRatings || [];
      case 'author': return analyticsData.authorRatings || [];
      case 'publisher': return analyticsData.publisherRatings || [];
      case 'content-gaps': return analyticsData['content-gapsGaps'] || [];
      case 'book': return analyticsData.bookTrends || [];
      default: return [];
    }
  };

  const renderContentGaps = () => {
    if (loading) return <div className="loading-spinner">Loading content gaps...</div>;

    const data = getCurrentData();
    console.log('Content gaps render data:', data);
    console.log('Analytics data:', analyticsData);
    
    if (!data || data.length === 0) return <div>No search failures found - all user searches are being satisfied!</div>;

    return (
      <div className="content-gaps-container">
        <div className="content-gaps-grid">
          {data.map((gap, index) => (
            <div key={index} className="content-gap-card">
              <div className="gap-header">
                <div className="gap-stats">
                  <span className="search-count">{gap.searchCount} searches</span>
                  <span className="user-count">{gap.userCount} users</span>
                </div>
              </div>
              
              <div className="gap-content">
                <h4 className="normalized-term">{gap.normalizedSearch}</h4>
                <div className="search-variations">
                  <strong>Search attempts:</strong>
                  <div className="variations-list">
                    {gap.searchVariations.map((variation, i) => (
                      <span key={i} className="variation-tag">{variation}</span>
                    ))}
                  </div>
                </div>
                
                <div className="gap-timeline">
                  <div className="timeline-item">
                    <span className="timeline-label">First searched:</span>
                    <span className="timeline-date">{new Date(gap.firstSearched).toLocaleDateString()}</span>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-label">Last searched:</span>
                    <span className="timeline-date">{new Date(gap.lastSearched).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (loading) return <div className="loading-spinner">Loading analytics...</div>;

    if (activeTab === 'content-gaps') {
      return renderContentGaps();
    }

    const data = getCurrentData();
    if (!data || data.length === 0) return <div>No data available to display chart.</div>;

    return (
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          {activeTab === 'book' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <YAxis 
                yAxisId="left" 
                orientation="left"
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1a1f24',
                  border: '1px solid #4299e1',
                  borderRadius: '8px',
                  color: '#e2e8f0'
                }}
              />
              <Legend wrapperStyle={{ color: '#e2e8f0' }} />
              <Line yAxisId="left" type="monotone" dataKey="rating" stroke="#8884d8" strokeWidth={3} name="Avg Rating" dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="reviews" stroke="#82ca9d" strokeWidth={3} name="Reviews" dot={{ r: 4 }} />
            </LineChart>
          ) : chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <YAxis 
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1a1f24',
                  border: '1px solid #4299e1',
                  borderRadius: '8px',
                  color: '#e2e8f0'
                }}
              />
              <Legend wrapperStyle={{ color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="avgRating" stroke="#8884d8" strokeWidth={3} name="Avg Rating" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="totalBooks" stroke="#82ca9d" strokeWidth={3} name="Total Books" dot={{ r: 4 }} />
            </LineChart>
          ) : chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="avgRating"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <YAxis 
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                axisLine={{ stroke: '#4299e1' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1a1f24',
                  border: '1px solid #4299e1',
                  borderRadius: '8px',
                  color: '#e2e8f0'
                }}
              />
              <Legend wrapperStyle={{ color: '#e2e8f0' }} />
              <Bar dataKey="avgRating" fill="url(#ratingGradient)" name="Avg Rating" radius={[2, 2, 0, 0]} />
              <Bar dataKey="totalBooks" fill="url(#booksGradient)" name="Total Books" radius={[2, 2, 0, 0]} />
              <defs>
                <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="booksGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  const calculateStats = () => {
    const data = getCurrentData();
    if (!data || data.length === 0) return { total: 0, highest: 0, lowest: 0, average: 0 };
    const ratings = data.map(item => item.avgRating || item.rating || 0);
    const total = data.length;
    const highest = Math.max(...ratings);
    const lowest = Math.min(...ratings);
    const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    return { total, highest, lowest, average };
  };

  const stats = calculateStats();

  const getDropdownOptions = () => {
    switch (activeTab) {
      case 'book': return analyticsData.availableBooks || [];
      case 'author': return analyticsData.availableAuthors || [];
      case 'publisher': return analyticsData.availablePublishers || [];
      default: return [];
    }
  };

  const getDropdownDisplayName = (item) => {
    if (typeof item === 'string') return item;
    return item.name || item.title || 'Unknown';
  };

  const getDropdownValue = (item) => {
    if (typeof item === 'string') return item;
    return item.id || item.name || item.title;
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'genre': return 'Genre-wise Ratings';
      case 'author': return 'Author Ratings';
      case 'publisher': return 'Publisher Ratings';
      case 'content-gaps': return 'Content Gap Analysis - What Users Want But Can\'t Find';
      case 'book': return 'Individual Book Trends';
      case 'user-activity': return 'User Active Time Insights';
      case 'user-engagement': return 'User Engagement & Ranking';
      case 'user-base': return 'User Base Overview';
      default: return 'Analytics';
    }
  };

  const handleUserClick = (userId) => {
    setSelectedUserId(userId);
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setSelectedUserId(null);
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <FilterProvider>
      <div className="analytics-dashboard">
        <Navbar 
          loggedIn={true} 
          onSearch={handleSearch}
          showFilters={true}
        />
        
        <div className="analytics-header">
          <button className="back-btn" onClick={handleBack}>← Back to Dashboard</button>
          <h1>Book Rating & Comparison Analytics</h1>
        </div>

        <div className="analytics-controls">
          <div className="tab-buttons">
            {['genre', 'author', 'publisher', 'content-gaps', 'user-activity', 'user-engagement'].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'user-activity' ? 'User Activity' : 
                 tab === 'user-engagement' ? 'User Engagement' :
                 tab === 'content-gaps' ? 'Content Gaps' :
                 `${tab.charAt(0).toUpperCase() + tab.slice(1)} Analysis`}
              </button>
            ))}
          </div>

          {!['user-activity', 'user-engagement', 'content-gaps'].includes(activeTab) && (
            <div className="filter-controls">
              <div className="date-filter">
                <label>Start Date:</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="date-filter">
                <label>End Date:</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              {['genre', 'author', 'publisher'].includes(activeTab) && (
                <>
                  <div className="item-selector">
                    <label>Display Type:</label>
                    <select value={displayType} onChange={(e) => setDisplayType(e.target.value)}>
                      <option value="top-rated">Top Rated</option>
                      <option value="lowest-rated">Lowest Rated</option>
                      <option value="most-books">Most Books</option>
                      <option value="least-books">Least Books</option>
                      {activeTab === 'genre' && <option value="most-engaging">Most Engaging</option>}
                    </select>
                  </div>
                  
                  <div className="item-selector">
                    <label>Show:</label>
                    <select value={limit} onChange={(e) => setLimit(e.target.value)}>
                      <option value="5">5 Items</option>
                      <option value="10">10 Items</option>
                      <option value="15">15 Items</option>
                      <option value="20">20 Items</option>
                      <option value="all">All Items</option>
                    </select>
                  </div>
                  
                  <div className="item-selector">
                    <label>Min Books:</label>
                    <input 
                      type="number" 
                      value={minBooks} 
                      onChange={(e) => setMinBooks(e.target.value)}
                      placeholder="e.g., 5"
                      min="0"
                    />
                  </div>
                  
                  <div className="item-selector">
                    <label>Min Rating:</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={minRating} 
                      onChange={(e) => setMinRating(e.target.value)}
                      placeholder="e.g., 3.0"
                      min="0"
                      max="5"
                    />
                  </div>
                </>
              )}

              {activeTab === 'content-gaps' && (
                <div className="item-selector">
                  <label>Show:</label>
                  <select value={limit} onChange={(e) => setLimit(e.target.value)}>
                    <option value="10">10 Items</option>
                    <option value="20">20 Items</option>
                    <option value="50">50 Items</option>
                    <option value="100">100 Items</option>
                    <option value="all">All Items</option>
                  </select>
                </div>
              )}

              {!['genre', 'author', 'publisher'].includes(activeTab) && (
                <div className="item-selector">
                  <label>Select {activeTab}:</label>
                  <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
                    <option value="">All {activeTab}s</option>
                    {getDropdownOptions().map((item, i) => (
                      <option key={i} value={getDropdownValue(item)}>{getDropdownDisplayName(item)}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab !== 'book' && (
                <div className="chart-type-selector">
                  <label>Chart Type:</label>
                  <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {['user-activity', 'user-engagement'].includes(activeTab) ? (
          <UserAnalytics 
            activeTab={activeTab}
            onUserClick={handleUserClick}
          />
        ) : (
          <div className="analytics-content">
            <div className="chart-container">
              <h2>{getTabTitle()}</h2>
              {renderChart()}
            </div>

            <div className="analytics-summary">
              <h3>Summary Statistics</h3>
              <div className="summary-grid">
                {['Total Items', 'Highest Rating', 'Lowest Rating', 'Average Rating'].map((label, i) => (
                  <div className="summary-card" key={i}>
                    <h4>{label}</h4>
                    <p>
                      {i === 0
                        ? stats.total
                        : stats[[null, 'highest', 'lowest', 'average'][i]].toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="detailed-table">
              <h3>Detailed Data</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Avg Rating</th>
                      <th>Books</th>
                      <th>Ratings</th>
                      {['genre', 'author', 'publisher'].includes(activeTab) && (
                        <>
                          <th>Reviews</th>
                          <th>Comments</th>
                          <th>Upvotes</th>
                          <th>Downvotes</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {getCurrentData().map((item, index) => (
                      <tr key={index}>
                        <td>{item.name || item.month}</td>
                        <td>{(item.avgRating || item.rating || 0).toFixed(1)}</td>
                        <td>{item.totalBooks || item.reviews || '-'}</td>
                        <td>{item.totalRatings || '-'}</td>
                        {['genre', 'author', 'publisher'].includes(activeTab) && (
                          <>
                            <td>{item.reviewCount || 0}</td>
                            <td>{item.commentCount || 0}</td>
                            <td className="upvotes">{item.upvotes || 0}</td>
                            <td className="downvotes">{item.downvotes || 0}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* User Profile Modal */}
        {showUserModal && selectedUserId && (
          <UserProfileModal 
            userId={selectedUserId}
            onClose={handleCloseUserModal}
          />
        )}
      </div>
    </FilterProvider>
  );
};

export default Analytics;
