import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AttendanceSheet() {
  const { courseId } = useParams();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSheet = () => {
    setLoading(true);
    setError('');
    setMessage('');
    api
      .get(`/attendance/course/${courseId}`, { params: { date } })
      .then((res) => {
        setRows(
          res.data.map((entry) => ({
            ...entry,
            pendingStatus: entry.status,
          }))
        );
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load the attendance sheet'))
      .finally(() => setLoading(false));
  };

  useEffect(loadSheet, [courseId, date]);

  const setPending = (studentId, status) => {
    setRows((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, pendingStatus: status } : row))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    const newRecords = rows
      .filter((row) => !row.attendanceId && row.pendingStatus)
      .map((row) => ({ studentId: row.studentId, status: row.pendingStatus }));

    const updates = rows.filter(
      (row) => row.attendanceId && row.pendingStatus && row.pendingStatus !== row.status
    );

    try {
      if (newRecords.length > 0) {
        await api.post('/attendance', { courseId, date, records: newRecords });
      }
      await Promise.all(
        updates.map((row) => api.patch(`/attendance/${row.attendanceId}`, { status: row.pendingStatus }))
      );
      setMessage('Attendance saved.');
      loadSheet();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  const hasPendingWork = rows.some((row) =>
    row.attendanceId ? row.pendingStatus && row.pendingStatus !== row.status : Boolean(row.pendingStatus)
  );

  return (
    <div className="container">
      <h1 className="page-title">Mark attendance</h1>
      <p className="page-subtitle">
        <Link to={`/courses/${courseId}`}>Back to course</Link>
      </p>

      <div className="card">
        <div className="form-field" style={{ maxWidth: 200 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No students enrolled in this course yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Roll no.</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>{row.rollNumber}</td>
                  <td>{row.name}</td>
                  <td>
                    <div className="status-toggle">
                      <button
                        type="button"
                        className={`status-btn ${row.pendingStatus === 'present' ? 'active-present' : ''}`}
                        onClick={() => setPending(row.studentId, 'present')}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        className={`status-btn ${row.pendingStatus === 'absent' ? 'active-absent' : ''}`}
                        onClick={() => setPending(row.studentId, 'absent')}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="btn-row">
          <button className="btn" onClick={handleSave} disabled={saving || !hasPendingWork}>
            {saving ? 'Saving…' : 'Save attendance'}
          </button>
        </div>
      )}
    </div>
  );
}
