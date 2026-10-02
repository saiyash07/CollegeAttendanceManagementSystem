import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setStudent(res.data.student);
      })
      .catch(() => {
        sessionStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  const applySession = (data) => {
    sessionStorage.setItem('token', data.token);
    setUser(data.user);
    setStudent(data.student);
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    applySession(res.data);
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    applySession(res.data);
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setUser(null);
    setStudent(null);
  };

  return (
    <AuthContext.Provider value={{ user, student, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
