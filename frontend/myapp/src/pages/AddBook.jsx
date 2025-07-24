// frontend/src/pages/AddBook.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddBook.css';

const AddBook = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [genres, setGenres] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [publications, setPublications] = useState([]);
  const [authors, setAuthors] = useState([]);

  const [selectedGenreId, setSelectedGenreId] = useState('');
  const [selectedLanguageId, setSelectedLanguageId] = useState('');
  const [selectedPublicationId, setSelectedPublicationId] = useState('');
  const [selectedAuthorIds, setSelectedAuthorIds] = useState([]);

  const [newGenre, setNewGenre] = useState('');
  const [newLanguage, setNewLanguage] = useState({ name: '', iso_code: '' });
  const [newPublication, setNewPublication] = useState({ name: '', address: '', country: '', contact_email: '' });
  const [newAuthor, setNewAuthor] = useState({ name: '', bio: '', date_of_birth: '', country: '' });

  const [bookInfo, setBookInfo] = useState({
    title: '',
    description: '',
    publication_date: '',
    cover_image: '',
    original_country: '',
    pdf_url: ''
  });

  const [moderatorId, setModeratorId] = useState(null);

  // Get moderator ID from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setModeratorId(payload.userId);
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetch('http://localhost:3000/addBook/genres').then(res => res.json()).then(setGenres).catch(console.error);
    fetch('http://localhost:3000/addBook/languages').then(res => res.json()).then(setLanguages).catch(console.error);
    fetch('http://localhost:3000/addBook/publication_houses').then(res => res.json()).then(setPublications).catch(console.error);
    fetch('http://localhost:3000/addBook/authors').then(res => res.json()).then(setAuthors).catch(console.error);
  }, []);

  const addGenre = async () => {
    if (!newGenre.trim()) return;
    const res = await fetch('http://localhost:3000/addBook/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGenre })
    });
    const data = await res.json();
    setGenres([...genres, data.genre]);
    setNewGenre('');
  };

  const addLanguage = async () => {
    const res = await fetch('http://localhost:3000/addBook/languages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLanguage)
    });
    const data = await res.json();
    setLanguages([...languages, data.language]);
    setNewLanguage({ name: '', iso_code: '' });
  };

  const addPublication = async () => {
    const res = await fetch('http://localhost:3000/addBook/publication_houses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPublication)
    });
    const data = await res.json();
    setPublications([...publications, data.publication_house]);
    setNewPublication({ name: '', address: '', country: '', contact_email: '' });
  };

  const addAuthor = async () => {
    const res = await fetch('http://localhost:3000/addBook/authors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAuthor)
    });
    const data = await res.json();
    setAuthors([...authors, data.author]);
    setNewAuthor({ name: '', bio: '', date_of_birth: '', country: '' });
  };

  const submitBook = async () => {
    const payload = {
      ...bookInfo,
      genre_id: selectedGenreId,
      language_id: selectedLanguageId,
      publication_house_id: selectedPublicationId,
      author_ids: selectedAuthorIds,
      added_by: moderatorId
    };
    try {
      const res = await fetch('http://localhost:3000/addBook/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Book added successfully with ID: ' + data.book_id);
        navigate('/moderator-dashboard');
      } else {
        alert('Error: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting book');
    }
  };

  const StepIndicator = () => {
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="step-indicator">
        {steps.map((stepNum) => (
          <div
            key={stepNum}
            className={`step-dot ${stepNum === step ? 'active' : stepNum < step ? 'completed' : ''}`}
          />
        ))}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Select Genre</h2>
            <div className="form-group">
              <label>Choose from existing genres:</label>
              <select value={selectedGenreId} onChange={e => setSelectedGenreId(e.target.value)}>
                <option value=''>Select Genre</option>
                {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="add-item-section">
              <h3>Add New Genre</h3>
              <input 
                type='text' 
                value={newGenre} 
                onChange={e => setNewGenre(e.target.value)} 
                placeholder='Enter new genre name' 
              />
              <button className="add-button" onClick={addGenre}>Add Genre</button>
            </div>

            <div className="nav-buttons">
              <div></div>
              <button 
                className="nav-button primary" 
                disabled={!selectedGenreId} 
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-content">
            <h2>Select Language</h2>
            <div className="form-group">
              <label>Choose from existing languages:</label>
              <select value={selectedLanguageId} onChange={e => setSelectedLanguageId(e.target.value)}>
                <option value=''>Select Language</option>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div className="add-item-section">
              <h3>Add New Language</h3>
              <div className="input-row">
                <input 
                  type='text' 
                  placeholder='Language Name' 
                  value={newLanguage.name} 
                  onChange={e => setNewLanguage({ ...newLanguage, name: e.target.value })} 
                />
                <input 
                  type='text' 
                  placeholder='ISO Code' 
                  value={newLanguage.iso_code} 
                  onChange={e => setNewLanguage({ ...newLanguage, iso_code: e.target.value })} 
                />
              </div>
              <button className="add-button" onClick={addLanguage}>Add Language</button>
            </div>

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(1)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedLanguageId} 
                onClick={() => setStep(3)}
              >
                Next
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Select Publication House</h2>
            <div className="form-group">
              <label>Choose from existing publication houses:</label>
              <select value={selectedPublicationId} onChange={e => setSelectedPublicationId(e.target.value)}>
                <option value=''>Select Publication House</option>
                {publications.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="add-item-section">
              <h3>Add New Publication House</h3>
              <input 
                type='text' 
                placeholder='Publication House Name' 
                value={newPublication.name} 
                onChange={e => setNewPublication({ ...newPublication, name: e.target.value })} 
              />
              <input 
                type='text' 
                placeholder='Address' 
                value={newPublication.address} 
                onChange={e => setNewPublication({ ...newPublication, address: e.target.value })} 
              />
              <div className="input-row">
                <input 
                  type='text' 
                  placeholder='Country' 
                  value={newPublication.country} 
                  onChange={e => setNewPublication({ ...newPublication, country: e.target.value })} 
                />
                <input 
                  type='email' 
                  placeholder='Contact Email' 
                  value={newPublication.contact_email} 
                  onChange={e => setNewPublication({ ...newPublication, contact_email: e.target.value })} 
                />
              </div>
              <button className="add-button" onClick={addPublication}>Add Publication House</button>
            </div>

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(2)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedPublicationId} 
                onClick={() => setStep(4)}
              >
                Next
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="step-content">
            <h2>Select Author(s)</h2>
            <div className="form-group">
              <label>Choose from existing authors (hold Ctrl/Cmd to select multiple):</label>
              <select 
                multiple 
                value={selectedAuthorIds} 
                onChange={e => setSelectedAuthorIds(Array.from(e.target.selectedOptions, o => o.value))}
              >
                {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="add-item-section">
              <h3>Add New Author</h3>
              <input 
                type='text' 
                placeholder='Author Name' 
                value={newAuthor.name} 
                onChange={e => setNewAuthor({ ...newAuthor, name: e.target.value })} 
              />
              <textarea 
                placeholder='Biography' 
                value={newAuthor.bio} 
                onChange={e => setNewAuthor({ ...newAuthor, bio: e.target.value })} 
              />
              <div className="input-row">
                <input 
                  type='date' 
                  value={newAuthor.date_of_birth} 
                  onChange={e => setNewAuthor({ ...newAuthor, date_of_birth: e.target.value })} 
                />
                <input 
                  type='text' 
                  placeholder='Country' 
                  value={newAuthor.country} 
                  onChange={e => setNewAuthor({ ...newAuthor, country: e.target.value })} 
                />
              </div>
              <button className="add-button" onClick={addAuthor}>Add Author</button>
            </div>

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(3)}>Back</button>
              <button 
                className="nav-button primary" 
                disabled={!selectedAuthorIds.length} 
                onClick={() => setStep(5)}
              >
                Next
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="step-content">
            <h2>Enter Book Information</h2>
            <div className="form-group">
              <label>Book Title:</label>
              <input 
                type='text' 
                placeholder='Enter book title' 
                value={bookInfo.title} 
                onChange={e => setBookInfo({ ...bookInfo, title: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea 
                placeholder='Enter book description' 
                value={bookInfo.description} 
                onChange={e => setBookInfo({ ...bookInfo, description: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Publication Date:</label>
              <input 
                type='date' 
                value={bookInfo.publication_date} 
                onChange={e => setBookInfo({ ...bookInfo, publication_date: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Cover Image URL:</label>
              <input 
                type='text' 
                placeholder='Enter cover image URL' 
                value={bookInfo.cover_image} 
                onChange={e => setBookInfo({ ...bookInfo, cover_image: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>Original Country:</label>
              <input 
                type='text' 
                placeholder='Enter original country' 
                value={bookInfo.original_country} 
                onChange={e => setBookInfo({ ...bookInfo, original_country: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label>PDF URL:</label>
              <input 
                type='text' 
                placeholder='Enter PDF URL' 
                value={bookInfo.pdf_url} 
                onChange={e => setBookInfo({ ...bookInfo, pdf_url: e.target.value })} 
              />
            </div>

            <div className="nav-buttons">
              <button className="nav-button" onClick={() => setStep(4)}>Back</button>
              <button className="nav-button success" onClick={submitBook}>Submit Book</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="add-book-page">
      <div className="add-book-header">
        <button className="back-btn" onClick={() => navigate('/moderator-dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>📚 Add Book</h1>
      </div>
      <StepIndicator />
      {renderStep()}
    </div>
  );
};

export default AddBook;