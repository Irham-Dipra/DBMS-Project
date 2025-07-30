// src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaUser, FaBan, FaCheck, FaCalendarAlt, FaEdit } from 'react-icons/fa';
import './UserManagement.css';
import Navbar from './Navbar';
import { FilterProvider } from '../contexts/FilterContext';

const UserManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('username');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'deactivate' or 'reactivate'
  const [deactivationReason, setDeactivationReason] = useState('');
  const [deactivationDuration, setDeactivationDuration] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, searchType]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch('http://localhost:3000/analytics/user-base-overview', { headers });
      const result = await response.json();

      if (result.success) {
        setUsers(result.users || []);
        setSummary(result.summary || {});
      } else {
        console.error('Failed to fetch user data:', result.message);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = users.filter(user => {
      switch (searchType) {
        case 'username':
          return user.username?.toLowerCase().includes(query);
        case 'email':
          return user.email?.toLowerCase().includes(query);
        case 'user_id':
          return user.id?.toString().includes(query);
        case 'name':
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
          return fullName.includes(query);
        default:
          return false;
      }
    });
    setFilteredUsers(filtered);
  };

  const handleUserAction = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setShowActionModal(true);
    setDeactivationReason('');
    setDeactivationDuration('');
  };

  const executeUserAction = async () => {
    if (!selectedUser) return;

    if (actionType === 'deactivate' && !deactivationReason.trim()) {
      alert('Please provide a reason for deactivation');
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const endpoint = actionType === 'deactivate' ? '/moderator/deactivate-user' : '/moderator/reactivate-user';
      const body = {
        userId: selectedUser.id,
        ...(actionType === 'deactivate' && {
          reason: deactivationReason,
          durationDays: deactivationDuration ? parseInt(deactivationDuration) : null
        }),
        ...(actionType === 'reactivate' && {
          reason: 'Manual reactivation by moderator'
        })
      };

      console.log('Sending request:', { endpoint, body }); // Debug log

      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.success) {
        alert(`User ${actionType === 'deactivate' ? 'deactivated' : 'reactivated'} successfully`);
        setShowActionModal(false);
        fetchUserData(); // Refresh the user data
      } else {
        alert(`Failed to ${actionType} user: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error);
      alert(`Error ${actionType}ing user. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setShowActionModal(false);
    setSelectedUser(null);
    setActionType('');
    setDeactivationReason('');
    setDeactivationDuration('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilReactivation = (user) => {
    if (!user.auto_reactivate_at) return null;
    const reactivateDate = new Date(user.auto_reactivate_at);
    const now = new Date();
    const diffTime = reactivateDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleSearch = (searchTerm) => {
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  if (loading) {
    return (
      <div className="user-management-container">
        <div className="loading-spinner">Loading user management data...</div>
      </div>
    );
  }

  return (
    <FilterProvider>
      <div className="user-management-container">
        <Navbar 
          loggedIn={true} 
          onSearch={handleSearch}
          showFilters={true}
        />
        
        <div className="user-management-header">
          <h2>User Management</h2>
          <p>Manage user accounts, search users, and control activation status</p>
        </div>

        {/* Summary Statistics */}
        <div className="user-summary-grid">
          <div className="summary-stat">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <div className="stat-value">{summary.total_users || 0}</div>
              <div className="stat-label">Total Users</div>
            </div>
          </div>
          <div className="summary-stat active">
            <div className="stat-icon">●</div>
            <div className="stat-info">
              <div className="stat-value">{summary.active_users || 0}</div>
              <div className="stat-label">Active Users</div>
            </div>
          </div>
          <div className="summary-stat inactive">
            <div className="stat-icon">●</div>
            <div className="stat-info">
              <div className="stat-value">{summary.inactive_users || 0}</div>
              <div className="stat-label">Deactivated Users</div>
            </div>
          </div>
          <div className="summary-stat new">
            <div className="stat-icon">●</div>
            <div className="stat-info">
              <div className="stat-value">{summary.new_users_week || 0}</div>
              <div className="stat-label">New This Week</div>
            </div>
          </div>
        </div>

        {/* Search Controls */}
        <div className="search-controls">
          <div className="search-input-group">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder={`Search by ${searchType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="search-type-select"
          >
            <option value="username">Username</option>
            <option value="email">Email</option>
            <option value="user_id">User ID</option>
            <option value="name">Full Name</option>
          </select>
          <button onClick={fetchUserData} className="refresh-btn" disabled={loading}>
            Refresh
          </button>
        </div>

        {/* User List */}
        <div className="user-list-container">
          <div className="user-list-header">
            <h3>User Details ({filteredUsers.length} users)</h3>
          </div>
          <div className="user-list">
            {filteredUsers.map(user => {
              const daysUntilReactivation = getDaysUntilReactivation(user);
              
              return (
                <div 
                  key={user.id} 
                  className={`user-item ${user.active_status ? 'active' : 'deactivated'}`}
                >
                  <div className="user-avatar">
                    <FaUser />
                  </div>
                  
                  <div className="user-details">
                    <div className="user-main-info">
                      <div className="user-name">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.username}
                      </div>
                      <div className="user-id">ID: {user.id}</div>
                    </div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-meta">
                      <span className="joined">Joined: {formatDate(user.created_at)}</span>
                      {user.last_login && (
                        <span className="last-login">
                          Last login: {formatDate(user.last_login)}
                        </span>
                      )}
                    </div>
                    
                    {!user.active_status && (
                      <div className="deactivation-info">
                        <div className="deactivation-reason">
                          <strong>Reason:</strong> {user.deactivation_reason || 'No reason provided'}
                        </div>
                        {user.deactivated_at && (
                          <div className="deactivation-date">
                            <strong>Deactivated:</strong> {formatDate(user.deactivated_at)}
                          </div>
                        )}
                        {daysUntilReactivation !== null && (
                          <div className="auto-reactivation">
                            <FaCalendarAlt />
                            {daysUntilReactivation > 0 
                              ? `Auto-reactivate in ${daysUntilReactivation} days`
                              : 'Scheduled for auto-reactivation'
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="user-status-actions">
                    <span className={`status-badge ${user.active_status ? 'active' : 'deactivated'}`}>
                      {user.active_status ? 'Active' : 'Deactivated'}
                    </span>
                    <div className="user-actions">
                      {user.active_status ? (
                        <button
                          onClick={() => handleUserAction(user, 'deactivate')}
                          className="action-btn deactivate-btn"
                          title="Deactivate User"
                        >
                          <FaBan /> Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUserAction(user, 'reactivate')}
                          className="action-btn reactivate-btn"
                          title="Reactivate User"
                        >
                          <FaCheck /> Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="no-users-found">
              <FaUser size={48} />
              <h3>No users found</h3>
              <p>Try adjusting your search criteria</p>
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && selectedUser && (
          <div className="modal-overlay">
            <div className="action-modal">
              <div className="modal-header">
                <h3>
                  {actionType === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
                </h3>
                <button onClick={closeModal} className="close-btn">×</button>
              </div>
              
              <div className="modal-content">
                <div className="user-info">
                  <strong>User:</strong> {selectedUser.username} ({selectedUser.email})
                </div>
                
                {actionType === 'deactivate' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="reason">Reason for deactivation *</label>
                      <textarea
                        id="reason"
                        value={deactivationReason}
                        onChange={(e) => setDeactivationReason(e.target.value)}
                        placeholder="Enter the reason for deactivating this user..."
                        rows={4}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="duration">Duration (days)</label>
                      <input
                        type="number"
                        id="duration"
                        value={deactivationDuration}
                        onChange={(e) => setDeactivationDuration(e.target.value)}
                        placeholder="Leave empty for permanent deactivation"
                        min="1"
                        max="365"
                      />
                      <small>If specified, the user will be automatically reactivated after this many days</small>
                    </div>
                  </>
                )}
                
                {actionType === 'reactivate' && (
                  <div className="reactivate-info">
                    <p>This will immediately reactivate the user and restore all their access privileges.</p>
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <button onClick={closeModal} className="cancel-btn" disabled={actionLoading}>
                  Cancel
                </button>
                <button
                  onClick={executeUserAction}
                  className={`confirm-btn ${actionType}-btn`}
                  disabled={actionLoading || (actionType === 'deactivate' && !deactivationReason.trim())}
                >
                  {actionLoading ? 'Processing...' : `${actionType === 'deactivate' ? 'Deactivate' : 'Reactivate'} User`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FilterProvider>
  );
};

export default UserManagement;