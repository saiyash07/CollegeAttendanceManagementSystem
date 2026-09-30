# College Attendance Management System

A backend-focused case study implementing a daily attendance system for a
college. Teachers mark attendance per class session, duplicate attendance
entries for the same student on the same date are rejected at the database
level, and students can view their own attendance percentage per course.

## Problem statement

A college wants teachers to mark daily attendance for their class. A teacher
should not be able to mark attendance twice for the same student on the same
date, and students should be able to view their own attendance percentage
for a course.

## Objectives

- Design Student, Course and Attendance schemas using Mongoose.
- Implement role-based access for teachers and students.
- Prevent duplicate attendance entries for the same student and date.
- Provide an endpoint to calculate a student's attendance percentage.
- Validate attendance data before saving.

## Outcomes

- Teachers can mark attendance for each class session.
- Duplicate attendance entries for the same date are blocked.
- Students can view their attendance percentage per course.
- Only teachers can create or modify attendance records.

## Tech stack

**Backend**
- Node.js, Express.js
- MongoDB Atlas with Mongoose as the ODM
- JSON Web Tokens (jsonwebtoken) for authentication
- bcryptjs for password hashing
- Hand-written request validation (no validation library) so every rule is
  explicit in plain JavaScript rather than hidden behind a schema-builder DSL

**Frontend**
- React 18, built and served with Vite
- react-router-dom for client-side routing
- axios for HTTP requests
- Plain hand-written CSS (no component library, no CSS framework)

## Repository structure

```
backend/
  server.js                    Entry point: loads env, connects MongoDB, starts the HTTP server
  src/
    app.js                     Express app (routes + middleware), no server.listen() here
    config/db.js                MongoDB connection
    models/
      User.js                   Auth identity for both roles: name, email, hashed password, role
      Student.js                Student profile: linked User, rollNumber, department
      Course.js                 name, code, teacher (ref User), students (ref Student[])
      Attendance.js              student, course, date, status, markedBy — with a compound
                                 unique index on {student, course, date}
    middleware/
      auth.js                    JWT authentication + role-based authorization
      validate.js                Hand-written request validators
      errorHandler.js            Central error-to-JSON-response handler
    controllers/                 Route logic: auth, course, student, attendance
    routes/                      Express routers for auth, courses, students, attendance
    utils/                       ApiError, asyncHandler, normalizeDate (calendar-day normalization)
  postman_collection.json        Importable Postman collection covering every endpoint
  .env.example                   Required environment variables (no real secrets)

frontend/
  src/
    api/axios.js                 Single Axios instance, attaches the JWT automatically
    context/AuthContext.jsx      Session state (user, student, token) and auth actions
    components/                  Navbar, ProtectedRoute
    pages/
      Login.jsx / Register.jsx    Authentication
      Dashboard.jsx                Course list (main list/dashboard view)
      AttendanceSheet.jsx          Attendance marking and correction (add/update form)
      CourseDetails.jsx            Roster management (teacher) or attendance percentage
                                    and history (student) — the details page
  .env.example                    Required environment variables

CONTENT.md                        Full design write-up: why each schema and decision was
                                   made, complete API reference, and a requirements checklist
```

## Data model

**User** — `{ name, email, password (hashed), role: 'teacher' | 'student' }`
Handles authentication for both roles in one collection, since login
behavior is identical regardless of role.

**Student** — `{ user: ref User, rollNumber, department }`
Kept separate from User because roll number and department are
student-specific domain data that a teacher account never has.

**Course** — `{ name, code, teacher: ref User, students: [ref Student] }`

**Attendance** — `{ student: ref Student, course: ref Course, date, status, markedBy: ref User }`
A compound unique index on `{ student, course, date }` is the actual
mechanism that prevents duplicate attendance. It is enforced by MongoDB
itself, so two concurrent requests marking the same student on the same day
cannot both succeed. Dates are normalized to UTC midnight before every write
and read, so "same calendar day" is consistent regardless of what time a
teacher submits the sheet.

## API reference

All routes are prefixed with `/api`. Protected routes require an
`Authorization: Bearer <token>` header.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Registers a teacher or student account |
| POST | `/auth/login` | public | Authenticates and returns a JWT |
| GET | `/auth/me` | authenticated | Returns the current session's user/student profile |
| POST | `/courses` | teacher | Creates a course |
| GET | `/courses` | authenticated | Lists the caller's courses (taught or enrolled) |
| GET | `/courses/:id` | authenticated (owner or enrolled) | Course detail with populated roster |
| POST | `/courses/:id/students` | teacher (course owner) | Enrolls a student into the course |
| GET | `/students` | teacher | Lists all students, for the enrollment picker |
| POST | `/attendance` | teacher (course owner) | Marks attendance for a class session (batch) |
| PATCH | `/attendance/:id` | teacher (course owner) | Corrects an already-marked record |
| GET | `/attendance/student/:studentId` | self or teacher | A student's attendance records |
| GET | `/attendance/percentage/:studentId` | self or teacher | Attendance percentage, via aggregation |
| GET | `/attendance/course/:courseId?date=` | teacher (course owner) | A day's attendance sheet for a course |

Full request/response shapes and design rationale are documented in
[CONTENT.md](./CONTENT.md).

## Environment configuration

**backend/.env**
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/attendance-db?retryWrites=true&w=majority
JWT_SECRET=<a long random string>
JWT_EXPIRES_IN=7d
```

**frontend/.env**
```
VITE_API_URL=http://localhost:5000/api
```

Neither `.env` file is committed; only the `.env.example` templates are.

## Running locally

```bash
# backend
cd backend
npm install
cp .env.example .env    # fill in MONGO_URI (MongoDB Atlas) and JWT_SECRET
npm run dev              # http://localhost:5000

# frontend, in a second terminal
cd frontend
npm install
cp .env.example .env    # point VITE_API_URL at the backend above
npm run dev              # http://localhost:5173
```

A Postman collection covering every endpoint is at
`backend/postman_collection.json`.

## Deployment

- Backend: Render or Railway, with `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  and `PORT` set as environment variables in the platform dashboard.
- Frontend: Vercel or Netlify, with `VITE_API_URL` set to the deployed
  backend's URL as a build-time environment variable.

## Further reading

[CONTENT.md](./CONTENT.md) contains the complete design write-up: the
reasoning behind every schema and middleware decision, the full API
contract, an explanation of the attendance-percentage aggregation pipeline,
and a checklist mapping every stated requirement to where it is implemented.
