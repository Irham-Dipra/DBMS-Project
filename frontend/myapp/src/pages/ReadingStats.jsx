import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBook, FaCalendarAlt, FaStar, FaArrowLeft, FaChartBar, FaBullseye, FaFire, FaUser, FaBookOpen, FaClock, FaTrophy, FaUsers, FaChartPie } from 'react-icons/fa';
import Navbar from '../components/Navbar';
import './ReadingStats.css';

function ReadingStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [genreStats, setGenreStats] = useState([]);
  const [authorStats, setAuthorStats] = useState([]);
  const [bookLengthStats, setBookLengthStats] = useState([]);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    setLoggedIn(!!token);
    
    if (!token) {
      navigate('/login');
      return;
    }

    fetchStats();
  }, [navigate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/myBooks/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setMonthlyStats(data.monthlyStats || []);
      setGenreStats(data.genreStats || []);
      setAuthorStats(data.authorStats || []);
      setBookLengthStats(data.bookLengthStats || []);
      setRatingDistribution(data.ratingDistribution || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short'
    });
  };


  const getAverageRating = () => {
    // Use library average rating (average of all books in user's library)
    if (!stats || !stats.books_with_ratings || stats.books_with_ratings === 0) return 0;
    return parseFloat(stats.library_avg_rating) || 0;
  };

  const getUserPersonalRating = () => {
    // User's personal ratings average
    if (!stats || !stats.rated_books || stats.rated_books === 0) return 0;
    return parseFloat(stats.user_avg_rating) || 0;
  };

  const getThisYearProgress = () => {
    return stats?.books_read_this_year || 0;
  };

  const getThisYearPages = () => {
    return stats?.pages_read_this_year || 0;
  };

  const getReadingStreak = () => {
    if (!monthlyStats.length) return 0;
    
    let streak = 0;
    const sortedStats = [...monthlyStats].sort((a, b) => b.month.localeCompare(a.month));
    
    for (const stat of sortedStats) {
      if (parseInt(stat.books_read) > 0) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const getTopGenres = () => {
    return genreStats.slice(0, 5);
  };

  const getTopAuthors = () => {
    return authorStats.slice(0, 5);
  };

  const getReadingPace = () => {
    if (!stats?.books_read || !monthlyStats.length) return 0;
    const monthsWithReading = monthlyStats.filter(m => parseInt(m.books_read) > 0).length;
    return monthsWithReading > 0 ? (stats.books_read / monthsWithReading).toFixed(1) : '0';
  };

  const getCompletionRate = () => {
    if (!stats?.total_books || stats.total_books === 0) return '0';
    return ((stats.books_read / stats.total_books) * 100).toFixed(1);
  };

  const getUserGoal = () => {
    return stats?.reading_goal || 12;
  };

  const updateReadingGoal = async (goal) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/myBooks/reading-goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ goal: parseInt(goal) })
      });

      if (!response.ok) {
        throw new Error('Failed to update reading goal');
      }

      // Refresh stats to get updated goal
      await fetchStats();
      setIsEditingGoal(false);
      setNewGoal('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoalEdit = () => {
    setNewGoal(getUserGoal().toString());
    setIsEditingGoal(true);
  };

  const handleGoalSave = () => {
    if (newGoal && parseInt(newGoal) >= 1 && parseInt(newGoal) <= 1000) {
      updateReadingGoal(newGoal);
    }
  };

  const handleGoalCancel = () => {
    setIsEditingGoal(false);
    setNewGoal('');
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };


  if (loading) {
    return (
      <div className="stats-container">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="stats-content">
          <div className="loading-spinner">Loading your reading stats...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-container">
        <Navbar 
          loggedIn={loggedIn} 
          onSearch={handleSearch}
        />
        <div className="stats-content">
          <div className="error-message">
            <p>Error: {error}</p>
            <button onClick={fetchStats}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />

      
      <div className="stats-content">
        <div className="stats-header">
          <button className="back-btn" onClick={() => navigate('/my-books')}>
            <FaArrowLeft />
            Back to My Books
          </button>
          <h1>Reading Statistics</h1>
          <p>Your personal reading journey insights</p>
        </div>

        <div className="stats-grid">
          {/* Overview Cards */}
          <div className="stats-card overview-card">
            <div className="card-header">
              <FaBook className="card-icon" />
              <h3>Library Overview</h3>
            </div>
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-number">{stats?.total_books || 0}</span>
                <span className="stat-label">Total Books</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats?.books_read || 0}</span>
                <span className="stat-label">Books Read</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats?.currently_reading || 0}</span>
                <span className="stat-label">Currently Reading</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats?.want_to_read || 0}</span>
                <span className="stat-label">Want to Read</span>
              </div>
            </div>
          </div>

          {/* This Year Progress */}
          <div className="stats-card progress-card">
            <div className="card-header">
              <FaBullseye className="card-icon" />
              <h3>This Year Progress</h3>
            </div>
            <div className="progress-content">
              <div className="progress-number">
                <span className="big-number">{getThisYearProgress()}</span>
                <span className="progress-label">books read in {new Date().getFullYear()}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.min((getThisYearProgress() / getUserGoal()) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {getThisYearProgress() >= getUserGoal() ? 'Goal achieved!' : `${getUserGoal() - getThisYearProgress()} books to reach yearly goal`}
              </p>
            </div>
          </div>

          {/* Reading Streak */}
          <div className="stats-card streak-card">
            <div className="card-header">
              <FaFire className="card-icon" />
              <h3>Reading Streak</h3>
            </div>
            <div className="streak-content">
              <div className="streak-number">
                <span className="big-number">{getReadingStreak()}</span>
                <span className="streak-label">consecutive months</span>
              </div>
              <p className="streak-text">
                {getReadingStreak() > 0 
                  ? `You've been consistently reading for ${getReadingStreak()} months!`
                  : 'Start your reading streak by finishing a book this month!'
                }
              </p>
            </div>
          </div>

          {/* Average Rating */}
          <div className="stats-card rating-card">
            <div className="card-header">
              <FaStar className="card-icon" />
              <h3>Average Rating</h3>
            </div>
            <div className="rating-content">
              <div className="rating-display">
                <span className="big-number">{(getAverageRating() || 0).toFixed(1)}</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <FaStar 
                      key={star} 
                      className={star <= getAverageRating() ? 'star-filled' : 'star-empty'}
                    />
                  ))}
                </div>
              </div>
              <p className="rating-text">
                Based on {stats?.books_with_ratings || 0} books in your library
              </p>
              {stats?.rated_books > 0 && (
                <p className="personal-rating-text">
                  Your personal rating average: {(getUserPersonalRating() || 0).toFixed(1)} ⭐ ({stats?.rated_books} rated by you)
                </p>
              )}
            </div>
          </div>

          {/* Monthly Reading Activity */}
          <div className="stats-card activity-card">
            <div className="card-header">
              <FaChartBar className="card-icon" />
              <h3>Monthly Reading Activity</h3>
            </div>
            <div className="activity-content">
              {monthlyStats.length > 0 ? (
                <div className="activity-chart">
                  {monthlyStats.slice(0, 12).map((stat, index) => (
                    <div key={index} className="activity-bar">
                      <div 
                        className="bar-fill" 
                        style={{ 
                          height: `${Math.max((parseInt(stat.books_read) / 5) * 100, 10)}%` 
                        }}
                      ></div>
                      <span className="bar-label">{formatDate(stat.month)}</span>
                      <span className="bar-value">{stat.books_read}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-activity">
                  <p>No reading activity data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Reading Insights */}
          <div className="stats-card insights-card">
            <div className="card-header">
              <FaCalendarAlt className="card-icon" />
              <h3>Reading Insights</h3>
            </div>
            <div className="insights-content">
              <div className="insight-item">
                <span className="insight-label">Most productive month:</span>
                <span className="insight-value">
                  {monthlyStats.length > 0 
                    ? formatDate(monthlyStats.reduce((max, stat) => 
                        parseInt(stat.books_read) > parseInt(max.books_read) ? stat : max
                      ).month)
                    : 'No data'
                  }
                </span>
              </div>
              <div className="insight-item">
                <span className="insight-label">Reading completion rate:</span>
                <span className="insight-value">
                  {stats?.total_books > 0 
                    ? `${((stats?.books_read / stats?.total_books) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="insight-item">
                <span className="insight-label">Average books per month:</span>
                <span className="insight-value">
                  {monthlyStats.length > 0 
                    ? (monthlyStats.reduce((sum, stat) => sum + parseInt(stat.books_read), 0) / monthlyStats.length).toFixed(1)
                    : '0'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Genre Distribution */}
          <div className="stats-card genre-card">
            <div className="card-header">
              <FaChartPie className="card-icon" />
              <h3>Favorite Genres</h3>
            </div>
            <div className="genre-content">
              {getTopGenres().length > 0 ? (
                <div className="genre-list">
                  {getTopGenres().map((genre, index) => (
                    <div key={index} className="genre-item">
                      <span className="genre-name">{genre.genre}</span>
                      <div className="genre-bar">
                        <div 
                          className="genre-fill" 
                          style={{ 
                            width: `${(genre.book_count / getTopGenres()[0].book_count) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="genre-count">{genre.book_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No genre data available</div>
              )}
            </div>
          </div>

          {/* Favorite Authors */}
          <div className="stats-card authors-card">
            <div className="card-header">
              <FaUser className="card-icon" />
              <h3>Favorite Authors</h3>
            </div>
            <div className="authors-content">
              {getTopAuthors().length > 0 ? (
                <div className="authors-list">
                  {getTopAuthors().map((author, index) => (
                    <div key={index} className="author-item">
                      <div className="author-info">
                        <span className="author-name">{author.author}</span>
                        <span className="author-books">{author.book_count} books</span>
                      </div>
                      <div className="author-rating">
                        <FaStar className="star-icon" />
                        <span>{author.avg_rating ? parseFloat(author.avg_rating).toFixed(1) : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No author data available</div>
              )}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="stats-card rating-dist-card">
            <div className="card-header">
              <FaStar className="card-icon" />
              <h3>Rating Distribution</h3>
            </div>
            <div className="rating-dist-content">
              {Object.keys(ratingDistribution).length > 0 ? (
                <div className="rating-bars">
                  {[5, 4, 3, 2, 1].map(rating => (
                    <div key={rating} className="rating-bar-item">
                      <span className="rating-label">{rating}⭐</span>
                      <div className="rating-bar">
                        <div 
                          className="rating-fill" 
                          style={{ 
                            width: `${(ratingDistribution[rating] / Math.max(...Object.values(ratingDistribution))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="rating-count">{ratingDistribution[rating] || 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No rating data available</div>
              )}
            </div>
          </div>

          {/* Book Length Preferences */}
          <div className="stats-card book-length-card">
            <div className="card-header">
              <FaBookOpen className="card-icon" />
              <h3>Book Length Preferences</h3>
            </div>
            <div className="book-length-content">
              {bookLengthStats.length > 0 ? (
                <div className="length-chart">
                  {bookLengthStats.map((length, index) => (
                    <div key={index} className="length-item">
                      <span className="length-label">{length.length_category}</span>
                      <div className="length-bar">
                        <div 
                          className="length-fill" 
                          style={{ 
                            width: `${(length.book_count / bookLengthStats[0].book_count) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="length-count">{length.book_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No book length data available</div>
              )}
            </div>
          </div>

          {/* Goals & Achievements */}
          <div className="stats-card goals-card">
            <div className="card-header">
              <FaTrophy className="card-icon" />
              <h3>Goals & Achievements</h3>
            </div>
            <div className="goals-content">
              <div className="goal-item">
                <div className="goal-icon">🎯</div>
                <div className="goal-info">
                  <h4>Annual Reading Goal</h4>
                  {isEditingGoal ? (
                    <div className="goal-edit">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        className="goal-input"
                      />
                      <div className="goal-buttons">
                        <button onClick={handleGoalSave} className="goal-save-btn">Save</button>
                        <button onClick={handleGoalCancel} className="goal-cancel-btn">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="goal-display">
                      <p>{getThisYearProgress()} / {getUserGoal()} books</p>
                      <button onClick={handleGoalEdit} className="goal-edit-btn">Edit Goal</button>
                    </div>
                  )}
                  <div className="goal-progress">
                    <div 
                      className="goal-progress-fill" 
                      style={{ width: `${Math.min((getThisYearProgress() / getUserGoal()) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="achievements">
                <h4>Achievements</h4>
                <div className="achievement-badges">
                  {stats?.books_read >= 1 && <div className="badge">📚 First Book</div>}
                  {stats?.books_read >= 5 && <div className="badge">🌟 Book Lover</div>}
                  {stats?.books_read >= 10 && <div className="badge">📖 Bookworm</div>}
                  {stats?.books_read >= 25 && <div className="badge">🏆 Reading Champion</div>}
                  {getReadingStreak() >= 3 && <div className="badge">🔥 Reading Streak</div>}
                  {stats?.avg_rating >= 4 && <div className="badge">⭐ Quality Reader</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Pages Read */}
          <div className="stats-card pages-card">
            <div className="card-header">
              <FaBookOpen className="card-icon" />
              <h3>Pages Read</h3>
            </div>
            <div className="pages-content">
              <div className="pages-stats">
                <div className="stat-item">
                  <span className="stat-number">{stats?.total_pages_read || 0}</span>
                  <span className="stat-label">Total Pages</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{getThisYearPages()}</span>
                  <span className="stat-label">This Year</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{Math.round(stats?.avg_pages_per_book || 0)}</span>
                  <span className="stat-label">Avg per Book</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReadingStats;