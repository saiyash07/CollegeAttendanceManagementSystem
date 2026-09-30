import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        Saiyash College Attendance Management System
      </Link>
      {user && (
        <div className="navbar-right">
          <span>
            {user.name} · {user.role}
          </span>
          <button className="btn-link" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
