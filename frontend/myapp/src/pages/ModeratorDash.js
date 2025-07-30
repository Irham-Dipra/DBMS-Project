// src/components/ModeratorDash.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Moderator.css';
import Navbar from '../components/Navbar';
import { FilterProvider } from '../contexts/FilterContext';

const ModeratorDash = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const res = await fetch('http://localhost:3000/auth/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          navigate('/login');
        }
      } catch (err) {
        console.error(err);
        navigate('/login');
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('http://localhost:3000/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('loggedIn');
    navigate('/');
    window.location.reload();
  };

  const handleAnalyticsClick = () => {
    navigate('/analytics');
  };

  const handleBooksManagementClick = () => {
    navigate('/moderator-books');
  };

  const handleUserManagementClick = () => {
    navigate('/user-management');
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  const getUserInitials = (user) => {
    if (!user) return '👤';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (user.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return '👤';
  };

  const getFullName = (user) => {
    if (!user) return '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    }
    return user.username || 'User';
  };

  return (
    <FilterProvider>
      <div className="moderator-dashboard">
        <Navbar 
          loggedIn={true} 
          onSearch={handleSearch}
          showFilters={true}
        />
        
        {/* Profile Section */}
        {user && (
          <div className="moderator-profile-section">
            <div className="moderator-profile-container">
              <div className="moderator-profile-left">
                <div className="moderator-profile-picture">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt="Profile" />
                  ) : (
                    <div className="moderator-profile-initials">{getUserInitials(user)}</div>
                  )}
                </div>
                <div className="moderator-profile-info">
                  <h2>{getFullName(user)}</h2>
                  <p className="username">@{user.username}</p>
                </div>
              </div>
              <div className="moderator-profile-right">
                <h1>Moderator Dashboard</h1>
              </div>
            </div>
          </div>
        )}
        
        <p>Welcome to the Moderator Dashboard!</p>
        <div className="dashboard-content">
          <div className="dashboard-card" onClick={handleBooksManagementClick} style={{ cursor: 'pointer' }}>
            <h3>Manage Books</h3>
            <p>Update or delete existing books</p>
          </div>
          <div className="dashboard-card" onClick={handleUserManagementClick} style={{ cursor: 'pointer' }}>
            <h3>Users Management</h3>
            <p>Manage user accounts, search users, and control activation status</p>
          </div>
          <div className="dashboard-card" onClick={handleAnalyticsClick} style={{ cursor: 'pointer' }}>
            <h3>Analytics</h3>
            <p>View platform statistics and analytics</p>
          </div>
        </div>
      </div>
    </FilterProvider>
  );
};

export default ModeratorDash;