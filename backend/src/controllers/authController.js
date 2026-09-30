const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Student = require('../models/Student');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
// Creates the User (auth identity) and, for students, the linked Student
// profile in one request so the client never has to make two calls.
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, rollNumber, department } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({ name, email, password, role });

  let student = null;
  if (role === 'student') {
    student = await Student.create({ user: user._id, rollNumber, department });
  }

  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    student: student ? { id: student._id, rollNumber: student.rollNumber, department: student.department } : null,
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  let student = null;
  if (user.role === 'student') {
    student = await Student.findOne({ user: user._id });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    student: student ? { id: student._id, rollNumber: student.rollNumber, department: student.department } : null,
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  let student = null;
  if (req.user.role === 'student') {
    student = await Student.findOne({ user: req.user._id });
  }

  res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
    student: student ? { id: student._id, rollNumber: student.rollNumber, department: student.department } : null,
  });
});

module.exports = { register, login, getMe };
