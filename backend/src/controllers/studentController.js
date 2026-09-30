const asyncHandler = require('../utils/asyncHandler');
const Student = require('../models/Student');

// GET /api/students (teacher only)
// Lets a teacher browse the full student directory when enrolling students
// into a course.
const listStudents = asyncHandler(async (req, res) => {
  const students = await Student.find().populate('user', 'name email');
  res.json(students);
});

module.exports = { listStudents };
