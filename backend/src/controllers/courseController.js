const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Course = require('../models/Course');
const Student = require('../models/Student');

// POST /api/courses (teacher only)
const createCourse = asyncHandler(async (req, res) => {
  const { name, code } = req.body;

  const course = await Course.create({ name, code, teacher: req.user._id });
  res.status(201).json(course);
});

// GET /api/courses
// Teachers see the courses they teach; students see the courses they're
// enrolled in. Keeps the list scoped without needing separate endpoints.
const listCourses = asyncHandler(async (req, res) => {
  let courses;

  if (req.user.role === 'teacher') {
    courses = await Course.find({ teacher: req.user._id }).populate('students');
  } else {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.json([]);
    courses = await Course.find({ students: student._id });
  }

  res.json(courses);
});

// GET /api/courses/:id
const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate('teacher', 'name email')
    .populate({ path: 'students', populate: { path: 'user', select: 'name email' } });

  if (!course) throw new ApiError(404, 'Course not found');

  const isOwner = req.user.role === 'teacher' && String(course.teacher._id) === String(req.user._id);
  const isEnrolled =
    req.user.role === 'student' &&
    course.students.some((s) => String(s.user._id) === String(req.user._id));

  if (!isOwner && !isEnrolled) {
    throw new ApiError(403, 'You do not have access to this course');
  }

  res.json(course);
});

// POST /api/courses/:id/students (teacher only)
// Enrolls an existing student into the course by their Student document id.
const addStudentToCourse = asyncHandler(async (req, res) => {
  const { studentId } = req.body;

  const course = await Course.findById(req.params.id);
  if (!course) throw new ApiError(404, 'Course not found');

  if (String(course.teacher) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the course teacher can enroll students');
  }

  const student = await Student.findById(studentId);
  if (!student) throw new ApiError(404, 'Student not found');

  if (course.students.some((id) => String(id) === String(studentId))) {
    throw new ApiError(409, 'Student is already enrolled in this course');
  }

  course.students.push(studentId);
  await course.save();

  res.json(course);
});

module.exports = { createCourse, listCourses, getCourseById, addStudentToCourse };
