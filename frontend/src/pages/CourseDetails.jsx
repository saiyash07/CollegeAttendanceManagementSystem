import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function TeacherView({ courseId, course, onEnrolled }) {
  const [allStudents, setAllStudents] = useState([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    api.get('/students').then((res) => setAllStudents(res.data));
  }, []);

  const enrolledIds = new Set(course.students.map((s) => s._id));
  const available = allStudents.filter((s) => !enrolledIds.has(s._id));

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setError('');
    setEnrolling(true);
    try {
      await api.post(`/courses/${courseId}/students`, { studentId: selected });
      setSelected('');
      onEnrolled();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <>
      <h2 className="section-heading">Enrolled students</h2>
      <div className="card">
        {course.students.length === 0 ? (
          <p className="empty-state">No students enrolled yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Roll no.</th>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {course.students.map((s) => (
                <tr key={s._id}>
                  <td>{s.rollNumber}</td>
                  <td>{s.user.name}</td>
                  <td>{s.user.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-heading">Enroll a student</h2>
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={handleEnroll} className="card">
        <div className="form-field">
          <label>Student</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a student…</option>
            {available.map((s) => (
              <option key={s._id} value={s._id}>
                {s.rollNumber} — {s.user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="btn-row">
          <button className="btn" type="submit" disabled={!selected || enrolling}>
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </form>
    </>
  );
}

function StudentView({ courseId, studentId }) {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    api
      .get(`/attendance/percentage/${studentId}`, { params: { courseId } })
      .then((res) => setSummary(res.data));
    api
      .get(`/attendance/student/${studentId}`, { params: { courseId } })
      .then((res) => setRecords(res.data));
  }, [courseId, studentId]);

  return (
    <>
      <h2 className="section-heading">Your attendance</h2>
      <div className="card">
        {summary ? (
          <>
            <div className="percentage-figure">{summary.percentage}%</div>
            <p className="muted">
              Present {summary.present} of {summary.total} sessions
            </p>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      <h2 className="section-heading">Session history</h2>
      <div className="card">
        {records.length === 0 ? (
          <p className="empty-state">No attendance recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function CourseDetails() {
  const { courseId } = useParams();
  const { user, student } = useAuth();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  const loadCourse = () => {
    api
      .get(`/courses/${courseId}`)
      .then((res) => setCourse(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load course'));
  };

  useEffect(loadCourse, [courseId]);

  if (error) {
    return (
      <div className="container">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">{course.name}</h1>
      <p className="page-subtitle">
        {course.code} · Taught by {course.teacher.name} · <Link to="/">Back to courses</Link>
      </p>

      {user.role === 'teacher' ? (
        <TeacherView courseId={courseId} course={course} onEnrolled={loadCourse} />
      ) : (
        <StudentView courseId={courseId} studentId={student.id} />
      )}
    </div>
  );
}
