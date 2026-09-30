const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

// Small hand-written validation layer instead of a validation library.
// For a case study this keeps the rules visible and explicit rather than
// hidden behind a schema-builder DSL.

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const isValidDateString = (value) => !Number.isNaN(new Date(value).getTime());

function validateRegister(req, res, next) {
  const { name, email, password, role, rollNumber, department } = req.body;
  const errors = [];

  if (!name || !name.trim()) errors.push('Name is required');
  if (!email || !isEmail(email)) errors.push('A valid email is required');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
  if (!role || !['teacher', 'student'].includes(role)) errors.push("Role must be 'teacher' or 'student'");

  if (role === 'student') {
    if (!rollNumber || !rollNumber.trim()) errors.push('Roll number is required for students');
    if (!department || !department.trim()) errors.push('Department is required for students');
  }

  if (errors.length) throw new ApiError(400, errors.join(', '));
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !isEmail(email)) errors.push('A valid email is required');
  if (!password) errors.push('Password is required');

  if (errors.length) throw new ApiError(400, errors.join(', '));
  next();
}

function validateCourse(req, res, next) {
  const { name, code } = req.body;
  const errors = [];

  if (!name || !name.trim()) errors.push('Course name is required');
  if (!code || !code.trim()) errors.push('Course code is required');

  if (errors.length) throw new ApiError(400, errors.join(', '));
  next();
}

function validateEnrollStudent(req, res, next) {
  const { studentId } = req.body;

  if (!studentId || !isObjectId(studentId)) {
    throw new ApiError(400, 'A valid studentId is required');
  }
  next();
}

function validateMarkAttendance(req, res, next) {
  const { courseId, date, records } = req.body;
  const errors = [];

  if (!courseId || !isObjectId(courseId)) errors.push('A valid courseId is required');
  if (!date || !isValidDateString(date)) errors.push('A valid date is required (e.g. 2024-03-05)');
  if (!Array.isArray(records) || records.length === 0) {
    errors.push('records must be a non-empty array of { studentId, status }');
  } else {
    records.forEach((record, index) => {
      if (!record.studentId || !isObjectId(record.studentId)) {
        errors.push(`records[${index}].studentId is invalid`);
      }
      if (!['present', 'absent'].includes(record.status)) {
        errors.push(`records[${index}].status must be 'present' or 'absent'`);
      }
    });
  }

  if (errors.length) throw new ApiError(400, errors.join(', '));
  next();
}

function validateUpdateAttendance(req, res, next) {
  const { status } = req.body;

  if (!['present', 'absent'].includes(status)) {
    throw new ApiError(400, "status must be 'present' or 'absent'");
  }
  next();
}

module.exports = {
  isObjectId,
  validateRegister,
  validateLogin,
  validateCourse,
  validateEnrollStudent,
  validateMarkAttendance,
  validateUpdateAttendance,
};
