import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', code: '' });
  const [creating, setCreating] = useState(false);

  const loadCourses = () => {
    setLoading(true);
    api
      .get('/courses')
      .then((res) => setCourses(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load courses'))
      .finally(() => setLoading(false));
  };

  useEffect(loadCourses, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/courses', form);
      setForm({ name: '', code: '' });
      loadCourses();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create course');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Courses</h1>
      <p className="page-subtitle">
        {user.role === 'teacher' ? 'Courses you teach.' : 'Courses you are enrolled in.'}
      </p>

      {error && <p className="error-text">{error}</p>}

      {user.role === 'teacher' && (
        <form onSubmit={handleCreate} className="card">
          <h3 className="section-heading" style={{ margin: '0 0 12px' }}>
            New course
          </h3>
          <div className="form-field">
            <label>Course name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-field">
            <label>Course code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="empty-state">No courses yet.</p>
        ) : (
          courses.map((course) => (
            <div className="list-row" key={course._id}>
              <div>
                <div className="list-row-title">{course.name}</div>
                <div className="list-row-meta">{course.code}</div>
              </div>
              <div className="btn-row" style={{ marginTop: 0 }}>
                {user.role === 'teacher' && (
                  <Link className="btn-secondary btn" to={`/courses/${course._id}/attendance`}>
                    Mark attendance
                  </Link>
                )}
                <Link className="btn-secondary btn" to={`/courses/${course._id}`}>
                  Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
