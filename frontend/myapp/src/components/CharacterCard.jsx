import React from 'react';
import { FaUser } from 'react-icons/fa';
import './CharacterCard.css';

function CharacterCard({ id, name, description, onClick }) {

  const handleClick = () => {
    if (onClick) {
      onClick(id);
    } else {
      // Navigate to character detail page if it exists
      // navigate(`/character/${id}`);
      console.log(`Character ${id} clicked`);
    }
  };

  return (
    <div className="character-card" onClick={handleClick}>
      <div className="character-profile-section">
        <div className="character-avatar">
          <div className="character-avatar-fallback">
            <FaUser className="character-icon" />
          </div>
        </div>
        
        <div className="character-info">
          <h3 className="character-name">{name}</h3>
          <p className="character-description">
            {description ? (description.length > 100 ? `${description.substring(0, 100)}...` : description) : 'No description available'}
          </p>
        </div>
      </div>
      
      <div className="character-card-hover-overlay">
        <span>View Character</span>
      </div>
    </div>
  );
}

export default CharacterCard;