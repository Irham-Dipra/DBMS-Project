import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import Homescroll from '../components/Homescroll';
import Navbar from '../components/Navbar';
import '../components/Navbar.css';



function Home() {
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // ✅ Check login state
    const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
    setLoggedIn(isLoggedIn);

    // ✅ Fetch homepage sections
    const fetchSections = async () => {
      try {
        // Check if user is logged in and get token
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Add authorization header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('http://localhost:3000/', { headers });
        const data = await res.json();
        if (!data.success || !data.data) throw new Error('Invalid response format');

        const sectionsArray = Object.values(data.data).map((section) => ({
          title: section.title,
          books: section.books,
        }));

        setSections(sectionsArray);
      } catch (err) {
        console.error('❌ Error fetching homepage data:', err.message);
      }
    };

    fetchSections();
  }, []);

  // REMOVED: The conflicting filter options fetch - FilterBar will handle this

  const handleSearch = (query) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };
  return (
    <div className="home-hero">
      <Navbar 
        loggedIn={loggedIn} 
        onSearch={handleSearch}
      />

      <div className="home-content">
        {/* ✅ Render all book sections (no filtering applied on home page) */}
        {sections.map((section, index) => (
          <Homescroll key={index} title={section.title} books={section.books} />
        ))}
      </div>
    </div>
  );
}

export default Home;