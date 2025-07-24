import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '', password: '', username: '', first_name: '', last_name: '', bio: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const validateField = (name, value) => {
    const errors = {};
    
    switch (name) {
      case 'username':
        if (value.length < 3) {
          errors.username = 'Username must be at least 3 characters long';
        }
        break;
      case 'password':
        if (value.length < 6) {
          errors.password = 'Password must be at least 6 characters long';
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'first_name':
        if (!value.trim()) {
          errors.first_name = 'First name is required';
        }
        break;
      case 'last_name':
        if (!value.trim()) {
          errors.last_name = 'Last name is required';
        }
        break;
    }
    
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Real-time validation
    const fieldErrors = validateField(name, value);
    setValidationErrors(prev => ({
      ...prev,
      [name]: fieldErrors[name] || null
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    // Validate all fields
    Object.keys(formData).forEach(key => {
      if (key !== 'bio') { // bio is optional
        const fieldErrors = validateField(key, formData[key]);
        if (fieldErrors[key]) {
          errors[key] = fieldErrors[key];
        }
      }
    });
    
    return errors;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Client-side validation before API call
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setValidationErrors(formErrors);
      setLoading(false);
      setMessage('Please fix the errors above before submitting.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/');
      } else {
        // Handle validation errors from backend
        if (data.errors && Array.isArray(data.errors)) {
          const backendErrors = {};
          data.errors.forEach(error => {
            if (error.path) {
              backendErrors[error.path] = error.msg;
            }
          });
          setValidationErrors(backendErrors);
        }
        setMessage(data.message);
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-wrapper">
      <div className="signup-container">
        <h2>Create Your Account</h2>
        {message && <div className="signup-message">{message}</div>}

        <form onSubmit={handleSignup}>
          <div className="form-field">
            <input 
              name="first_name" 
              placeholder="First Name" 
              value={formData.first_name} 
              onChange={handleChange} 
              required 
              className={validationErrors.first_name ? 'error' : ''}
            />
            {validationErrors.first_name && <div className="field-error">{validationErrors.first_name}</div>}
          </div>

          <div className="form-field">
            <input 
              name="last_name" 
              placeholder="Last Name" 
              value={formData.last_name} 
              onChange={handleChange} 
              required 
              className={validationErrors.last_name ? 'error' : ''}
            />
            {validationErrors.last_name && <div className="field-error">{validationErrors.last_name}</div>}
          </div>

          <div className="form-field">
            <input 
              name="username" 
              placeholder="Username (min 3 characters)" 
              value={formData.username} 
              onChange={handleChange} 
              required 
              className={validationErrors.username ? 'error' : ''}
            />
            {validationErrors.username && <div className="field-error">{validationErrors.username}</div>}
            <div className="field-hint">Username must be at least 3 characters long</div>
          </div>

          <div className="form-field">
            <input 
              name="email" 
              type="email" 
              placeholder="Email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
              className={validationErrors.email ? 'error' : ''}
            />
            {validationErrors.email && <div className="field-error">{validationErrors.email}</div>}
          </div>

          <div className="form-field">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 6 characters)"
              value={formData.password}
              onChange={handleChange}
              required
              className={validationErrors.password ? 'error' : ''}
            />
            {validationErrors.password && <div className="field-error">{validationErrors.password}</div>}
            <div className="field-hint">Password must be at least 6 characters long</div>
          </div>

          <div className="password-toggle">
            <label>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
              />
              Show password
            </label>
          </div>

          <div className="form-field">
            <textarea
              name="bio"
              placeholder="Bio (Optional)"
              rows="3"
              value={formData.bio}
              onChange={handleChange}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>

        <button className="switch-btn" onClick={() => navigate('/login')}>
          Already have an account? Login
        </button>
      </div>
    </div>
  );
};

export default Signup;
