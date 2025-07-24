// src/App.js
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './contexts/FilterContext';
import Home from './pages/Home';
import Login from './pages/Login';
import IndividualBook from './pages/IndividualBook';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Wishlist from './pages/Wishlist';
import SearchResults from './pages/SearchResults';
import AddBook from './pages/AddBook';
import MyBooks from './pages/MyBooks';
import ReadingStats from './pages/ReadingStats';
import Author from './pages/Author';
import Browse from './pages/Browse';
import ModeratorDash from './pages/ModeratorDash';
import Analytics from './components/Analytics';
import ModeratorBooks from './components/ModeratorBooks';
import UserManagement from './components/UserManagement';

function App() {
  return (
    <Router>
      <FilterProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/login" element={<Login />} />
          <Route path="/book/:id" element={<IndividualBook />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/addbook" element={<AddBook />} />
          <Route path="/my-books" element={<MyBooks />} />
          <Route path="/my-books/stats" element={<ReadingStats />} />
          <Route path="/author/:id" element={<Author />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/moderator-dashboard" element={<ModeratorDash />} />
          <Route path="/moderator-books" element={<ModeratorBooks />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </FilterProvider>
    </Router>
  );
}

export default App;