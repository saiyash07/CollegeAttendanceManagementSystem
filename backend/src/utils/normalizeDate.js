// Strips the time portion of a date so "2024-03-05T14:30:00" and
// "2024-03-05T09:00:00" are treated as the same day for attendance purposes.
// This is what makes the {student, course, date} unique index actually work -
// without it, two teachers marking the same day at different times would
// produce two different Date values and slip past the duplicate check.
function normalizeDate(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

module.exports = normalizeDate;
