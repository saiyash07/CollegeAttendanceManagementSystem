const express = require('express');
const {
  createCourse,
  listCourses,
  getCourseById,
  addStudentToCourse,
} = require('../controllers/courseController');
const { validateCourse, validateEnrollStudent } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('teacher'), validateCourse, createCourse);
router.get('/', listCourses);
router.get('/:id', getCourseById);
router.post('/:id/students', authorize('teacher'), validateEnrollStudent, addStudentToCourse);

module.exports = router;
