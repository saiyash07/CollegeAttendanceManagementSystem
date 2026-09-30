const express = require('express');
const {
  markAttendance,
  updateAttendance,
  getStudentAttendance,
  getAttendancePercentage,
  getCourseAttendanceForDate,
} = require('../controllers/attendanceController');
const { validateMarkAttendance, validateUpdateAttendance } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('teacher'), validateMarkAttendance, markAttendance);
router.patch('/:id', authorize('teacher'), validateUpdateAttendance, updateAttendance);
router.get('/student/:studentId', getStudentAttendance);
router.get('/percentage/:studentId', getAttendancePercentage);
router.get('/course/:courseId', authorize('teacher'), getCourseAttendanceForDate);

module.exports = router;
