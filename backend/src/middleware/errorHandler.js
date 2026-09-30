const ApiError = require('../utils/ApiError');

// Central place that turns any thrown/rejected error into a consistent
// { message } JSON response, so controllers never format error responses
// themselves.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Mongoose schema validation (required fields, enum, minlength, etc.)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ message });
  }

  // Duplicate key from a unique index (email, course code, or the
  // {student, course, date} attendance index).
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    return res.status(409).json({
      message: `Duplicate value for field(s): ${field}`,
    });
  }

  // Malformed ObjectId in a route param or body field.
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = errorHandler;
