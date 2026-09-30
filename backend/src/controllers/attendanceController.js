const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const Student = require('../models/Student');
const normalizeDate = require('../utils/normalizeDate');

// Resolves the Student document that belongs to the currently logged in
// user. Returns null if the logged in user is a teacher (they have no
// Student profile).
async function getOwnStudentId(user) {
  if (user.role !== 'student') return null;
  const student = await Student.findOne({ user: user._id });
  return student ? String(student._id) : null;
}

async function assertOwnsCourse(courseId, teacherId) {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  if (String(course.teacher) !== String(teacherId)) {
    throw new ApiError(403, 'Only the course teacher can manage attendance for this course');
  }
  return course;
}

// POST /api/attendance (teacher only)
// Marks attendance for a whole class session in one call: a course, a date,
// and a { studentId, status } entry per student. Each entry is inserted
// independently so one duplicate doesn't fail the entire class's sheet -
// the unique index on Attendance is what actually blocks re-marking the
// same student twice for the same day.
const markAttendance = asyncHandler(async (req, res) => {
  const { courseId, date, records } = req.body;

  const course = await assertOwnsCourse(courseId, req.user._id);
  const normalizedDate = normalizeDate(date);

  const enrolledIds = new Set(course.students.map((id) => String(id)));
  const created = [];
  const skipped = [];

  for (const record of records) {
    if (!enrolledIds.has(String(record.studentId))) {
      skipped.push({ studentId: record.studentId, reason: 'Student is not enrolled in this course' });
      continue;
    }

    try {
      const attendance = await Attendance.create({
        student: record.studentId,
        course: courseId,
        date: normalizedDate,
        status: record.status,
        markedBy: req.user._id,
      });
      created.push(attendance);
    } catch (err) {
      if (err.code === 11000) {
        skipped.push({ studentId: record.studentId, reason: 'Attendance already marked for this date' });
      } else {
        throw err;
      }
    }
  }

  res.status(201).json({ created, skipped });
});

// PATCH /api/attendance/:id (teacher only)
// Corrects an already-marked record's status. This updates the existing
// document rather than creating a new one, so it does not conflict with
// the duplicate-prevention index.
const updateAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) throw new ApiError(404, 'Attendance record not found');

  await assertOwnsCourse(attendance.course, req.user._id);

  attendance.status = req.body.status;
  await attendance.save();

  res.json(attendance);
});

// GET /api/attendance/student/:studentId
// A student may only view their own record; a teacher may view any student.
const getStudentAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { courseId } = req.query;

  const ownStudentId = await getOwnStudentId(req.user);
  if (ownStudentId && ownStudentId !== studentId) {
    throw new ApiError(403, 'You can only view your own attendance');
  }

  const filter = { student: studentId };
  if (courseId) filter.course = courseId;

  const records = await Attendance.find(filter).populate('course', 'name code').sort({ date: -1 });
  res.json(records);
});

// GET /api/attendance/percentage/:studentId
// With ?courseId=... returns the percentage for that course only.
// Without it, returns a per-course breakdown for the student.
const getAttendancePercentage = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { courseId } = req.query;

  const ownStudentId = await getOwnStudentId(req.user);
  if (ownStudentId && ownStudentId !== studentId) {
    throw new ApiError(403, 'You can only view your own attendance');
  }

  const match = { student: new mongoose.Types.ObjectId(studentId) };
  if (courseId) match.course = new mongoose.Types.ObjectId(courseId);

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$course',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    {
      $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' },
    },
    { $unwind: '$course' },
    {
      $project: {
        _id: 0,
        courseId: '$course._id',
        courseName: '$course.name',
        courseCode: '$course.code',
        total: 1,
        present: 1,
        percentage: {
          $cond: [{ $eq: ['$total', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] }],
        },
      },
    },
  ]);

  if (courseId) {
    return res.json(rows[0] || { courseId, total: 0, present: 0, percentage: 0 });
  }

  res.json(rows);
});

// GET /api/attendance/course/:courseId?date=... (teacher only)
// Shows every enrolled student alongside their status for that date (or
// null if not yet marked) - used to render/prefill the attendance sheet.
const getCourseAttendanceForDate = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { date } = req.query;

  if (!date) throw new ApiError(400, 'A date query parameter is required');

  const course = await assertOwnsCourse(courseId, req.user._id);
  const normalizedDate = normalizeDate(date);

  await course.populate({ path: 'students', populate: { path: 'user', select: 'name email' } });

  const records = await Attendance.find({ course: courseId, date: normalizedDate });
  const statusByStudent = new Map(records.map((r) => [String(r.student), r]));

  const sheet = course.students.map((student) => {
    const record = statusByStudent.get(String(student._id));
    return {
      studentId: student._id,
      name: student.user.name,
      rollNumber: student.rollNumber,
      status: record ? record.status : null,
      attendanceId: record ? record._id : null,
    };
  });

  res.json(sheet);
});

module.exports = {
  markAttendance,
  updateAttendance,
  getStudentAttendance,
  getAttendancePercentage,
  getCourseAttendanceForDate,
};
