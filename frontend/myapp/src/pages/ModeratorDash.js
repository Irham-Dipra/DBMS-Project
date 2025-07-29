// src/components/ModeratorDash.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Moderator.css';

const ModeratorDash = () => {
  const navigate = useNavigate();

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

  return (
    <div className="moderator-dashboard">
      <div className="moderator-header">
        <h1>Moderator Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
      <p>Welcome to the Moderator Dashboard!</p>
      <div className="dashboard-content">
        <div className="dashboard-card" onClick={handleBooksManagementClick} style={{ cursor: 'pointer' }}>
          <h3>📖 Manage Books</h3>
          <p>Update or delete existing books</p>
        </div>
        <div className="dashboard-card" onClick={handleUserManagementClick} style={{ cursor: 'pointer' }}>
          <h3>👥 Users Management</h3>
          <p>Manage user accounts, search users, and control activation status</p>
        </div>
        <div className="dashboard-card">
          <h3>Content Moderation</h3>
          <p>Review and moderate user content</p>
        </div>
        <div className="dashboard-card">
          <h3>Reports</h3>
          <p>Handle user reports and complaints</p>
        </div>
        <div className="dashboard-card" onClick={handleAnalyticsClick} style={{ cursor: 'pointer' }}>
          <h3>📊 Analytics</h3>
          <p>View platform statistics and analytics</p>
        </div>
      </div>
    </div>
  );
};

export default ModeratorDash;