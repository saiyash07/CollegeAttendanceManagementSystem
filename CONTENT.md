# Attendance Management System — Content Guide

This document explains what was built, how the pieces fit together, and *why*
each decision was made — so the reasoning behind the code is on record, not
just the code itself.

---

## 1. Problem restated

A college needs teachers to mark daily attendance per class. Two hard rules:

1. A teacher can't mark the same student twice for the same date.
2. A student can see their own attendance percentage per course.

Everything below is built around satisfying those two rules correctly, plus
the surrounding CRUD and access-control work needed to make them usable.

---

## 2. Project layout

```
backend/
  src/
    config/db.js              MongoDB connection
    models/                   Mongoose schemas: User, Student, Course, Attendance
    middleware/                auth (JWT + roles), validate (manual checks), errorHandler
    controllers/               route logic, grouped by resource
    routes/                    Express routers, grouped by resource
    utils/                     ApiError, asyncHandler, normalizeDate
    app.js                     Express app wiring (no server.listen here)
  server.js                    loads env, connects DB, starts the HTTP server
  postman_collection.json      importable request collection
  .env.example                 required environment variables, no real secrets

frontend/
  src/
    api/axios.js               one Axios instance, baseURL from env, attaches JWT
    context/AuthContext.jsx    holds the logged-in user/student + token in localStorage
    components/                Navbar, ProtectedRoute
    pages/                     Login, Register, Dashboard, AttendanceSheet, CourseDetails
```

`app.js` and `server.js` are split on purpose: `app.js` is the pure Express
app (routes + middleware, no side effects), which is what the automated
tests import and run against an in-memory database. `server.js` is the only
file that touches a real network port or a real database connection.

---

## 3. Data model — and why it's shaped this way

### User (`models/User.js`)
Holds login identity for *both* roles: `name`, `email`, `password` (bcrypt
hashed), `role` (`teacher` | `student`). One collection for auth, rather than
separate `Teacher`/`Student` login tables, because login behavior (hash,
compare, sign a JWT) is identical for both roles — only the profile data
differs.

### Student (`models/Student.js`)
`{ user: ref User, rollNumber, department }`. Kept separate from `User`
because the case study explicitly asks for a `Student` schema, and because
roll number / department are domain data that a teacher account will never
have. A student's identity for attendance purposes is always their `Student`
document id, not their `User` id — that distinction matters everywhere
attendance is queried.

### Course (`models/Course.js`)
`{ name, code (unique), teacher: ref User, students: [ref Student] }`.
Enrollment is modeled as an array on the course rather than a separate
join collection because class sizes are small and the only query pattern
needed is "give me this course's roster," which `populate('students')`
answers directly.

### Attendance (`models/Attendance.js`)
`{ student, course, date, status, markedBy }`, with a **compound unique
index on `{student, course, date}`**.

This index is the actual mechanism that satisfies requirement #1
(no duplicate attendance for the same student/date). It is enforced by
MongoDB itself, not by an application-level "check then insert," which
matters under concurrent requests — two simultaneous requests to mark the
same student on the same day cannot both succeed no matter how the
application code is scheduled. The controller still does a friendly
pre-check where useful, but the index is the real guarantee.

For the index to work, "date" has to mean *calendar day*, not a timestamp —
otherwise 9:00am and 2:00pm on the same day would be two different `Date`
values and slip past the index entirely. `utils/normalizeDate.js` strips the
time component (sets it to UTC midnight) before every write and every
lookup, so "2024-03-05" always resolves to the same stored value regardless
of what time the teacher happened to submit the sheet.

---

## 4. Authentication & role-based access

- **JWT**, signed with `JWT_SECRET`, containing `{ id, role }`. Sent as
  `Authorization: Bearer <token>` and verified on every protected route.
- `middleware/auth.js` exports two pieces:
  - `authenticate` — verifies the token and re-fetches the user from the
    database on every request (rather than trusting the JWT payload as-is),
    so a deleted account can't keep using an old token.
  - `authorize(...roles)` — a small factory, e.g. `authorize('teacher')`,
    used on routes that only one role should reach.
- Beyond role checks, some routes need *ownership* checks that a role check
  alone can't express — e.g. "a teacher may only mark attendance for a
  course they teach," or "a student may only view their own attendance."
  Those live in the controllers (`assertOwnsCourse`, `getOwnStudentId`)
  because they depend on the specific resource being accessed, not just the
  caller's role.

## 5. Why validation is hand-written instead of a library

The project deliberately does not pull in a validation library (Joi,
express-validator, celebA). `middleware/validate.js` is a short, explicit set
of functions — one per endpoint shape — that check required fields, email
format, enum membership, and ObjectId validity, then throw a single
`ApiError(400, ...)` with all problems joined into one message. For a
project this size, a hand-rolled validator is easier to read top-to-bottom
than a schema-builder DSL, and it keeps the dependency list small and every
rule visible in plain JavaScript.

`middleware/errorHandler.js` is the single place that turns *any* thrown
error — a validation `ApiError`, a Mongoose `ValidationError`, a duplicate
key error (`code 11000`, which is what actually fires when the attendance
unique index is violated), a bad ObjectId (`CastError`), or a JWT error —
into a consistent `{ message }` JSON response. Controllers never format
error responses themselves; they just `throw`.

---

## 6. API reference

All routes are prefixed with `/api`. Protected routes require
`Authorization: Bearer <token>`.

### Auth
| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password, role, rollNumber?, department? }` (roll number/department required when `role` is `student`) |
| POST | `/auth/login` | public | `{ email, password }` |
| GET | `/auth/me` | authenticated | — |

### Courses
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/courses` | teacher | Creates a course owned by the caller |
| GET | `/courses` | authenticated | Teacher → courses they teach. Student → courses they're enrolled in |
| GET | `/courses/:id` | authenticated (owner or enrolled) | Full course detail with populated roster |
| POST | `/courses/:id/students` | teacher (course owner) | `{ studentId }` — enrolls an existing student |

### Students
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/students` | teacher | Directory used to pick a student to enroll |

### Attendance
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/attendance` | teacher (course owner) | `{ courseId, date, records: [{ studentId, status }] }` — marks a whole class session at once; returns `{ created, skipped }`, where `skipped` lists duplicates and non-enrolled students with a reason |
| PATCH | `/attendance/:id` | teacher (course owner) | `{ status }` — corrects an already-marked record without creating a duplicate |
| GET | `/attendance/student/:studentId` | self (student) or teacher | Optional `?courseId=` filter |
| GET | `/attendance/percentage/:studentId` | self (student) or teacher | With `?courseId=`, returns `{ total, present, percentage }` for that course. Without it, returns a per-course breakdown array |
| GET | `/attendance/course/:courseId?date=` | teacher (course owner) | Every enrolled student plus their status for that date (`null` if unmarked) — powers the attendance sheet UI |

### Attendance percentage — how it's actually computed

`getAttendancePercentage` runs a MongoDB aggregation rather than pulling
records into Node and looping:

```
$match   → records for this student (and course, if given)
$group   → total count + count where status == 'present'
$lookup  → join course name/code back in
$project → percentage = round((present / total) * 100, 2), guarded against
           division by zero when total is 0
```

Doing the count and the percentage math inside MongoDB avoids pulling every
attendance row over the wire just to count them, and keeps the "0 records
yet" case (new student, new course) from throwing on a divide-by-zero.

---

## 7. Frontend

React (Vite) + `react-router-dom` + `axios`. No UI component library and no
CSS framework — one hand-written stylesheet (`src/index.css`) using plain
CSS variables, borders instead of shadows, and a system-serif/neutral
palette, specifically to avoid the generic "AI-generated" look that comes
from default Tailwind/Material components (gradients, glassmorphism, pill
buttons everywhere). All logic — validation, duplicate prevention,
percentage math, authorization — lives in the backend; the frontend only
renders responses and posts form data via the single Axios instance in
`api/axios.js`.

| Page | Role | Maps to case-study requirement |
|---|---|---|
| `Login.jsx` / `Register.jsx` | both | Login/Register |
| `Dashboard.jsx` | both (content differs) | main List/Dashboard view — course list, teacher can create a course inline |
| `AttendanceSheet.jsx` | teacher | Add/Update form — marking new attendance is a POST, correcting an already-marked entry is a PATCH, both from the same sheet |
| `CourseDetails.jsx` | both (content differs) | Details page — teacher sees roster + enroll form; student sees their percentage + session history |

`AuthContext.jsx` keeps the JWT in `localStorage`, rehydrates the session on
page load via `GET /auth/me`, and exposes `login`/`register`/`logout`.
`ProtectedRoute.jsx` redirects to `/login` when there's no session, and can
also gate a route to a specific role (used for `/courses/:id/attendance`,
which only teachers should reach).

---

## 8. Environment configuration

**backend/.env** (see `backend/.env.example`)
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/attendance-db?retryWrites=true&w=majority
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
```

**frontend/.env** (see `frontend/.env.example`)
```
VITE_API_URL=http://localhost:5000/api
```

Neither `.env` file is committed (`.gitignore` excludes them in both
folders); only the `.example` templates are.

---

## 9. Running it locally

```
# backend
cd backend
npm install
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm run dev             # http://localhost:5000

# frontend
cd frontend
npm install
cp .env.example .env   # point VITE_API_URL at the backend above
npm run dev             # http://localhost:5173
```

---

## 10. Deployment

- **Backend** → Render or Railway. Set `PORT` (most platforms inject this
  automatically), `MONGO_URI` (MongoDB Atlas connection string), `JWT_SECRET`,
  and `JWT_EXPIRES_IN` as environment variables in the platform dashboard —
  never commit them.
- **Frontend** → Vercel or Netlify. Set `VITE_API_URL` to the deployed
  backend's URL (e.g. `https://your-api.onrender.com/api`) as a build-time
  environment variable.

---

## 11. What was verified, and how

- A full backend integration test (register/login for both roles, course
  creation, enrollment, duplicate-enrollment rejection, attendance marking,
  **duplicate attendance rejection**, non-enrolled-student rejection,
  role-based 403s, percentage calculation before/after a correction, and
  unauthenticated 401s — 25 assertions total) was run against a real
  MongoDB engine and passed. The test script itself is not part of the
  deliverable (it was a throwaway verification harness, not a project
  dependency) and was removed after use.
- The same flows were re-verified with `curl` against the actual dev server
  (`server.js`) and a real local MongoDB instance, not just the test
  harness, to confirm the production code path (not just the test
  scaffolding) behaves correctly.
- The frontend was built with `vite build` to confirm there are no compile
  errors, and both dev servers were run together (backend on a real Mongo
  connection, frontend pointed at it via `VITE_API_URL`) to confirm they
  talk to each other correctly end-to-end at the HTTP level.
- **Caveat:** no browser-automation tool was available in this session, so
  the UI was not click-tested visually in an actual browser window. The
  request/response contract between every frontend page and its backend
  endpoint was cross-checked by reading both sides together (field names,
  payload shapes, populated fields), but a manual click-through before
  submitting the case study is still worth doing.

---

## 12. Requirements checklist

| Requirement | Where |
|---|---|
| Student, Course, Attendance schemas (Mongoose) | `backend/src/models/*.js` |
| Role-based access for teachers/students | `middleware/auth.js` (`authorize`) + ownership checks in controllers |
| Prevent duplicate attendance (same student + date) | Unique compound index in `Attendance.js`, backed by `normalizeDate.js` |
| Attendance percentage endpoint | `GET /attendance/percentage/:studentId`, aggregation in `attendanceController.js` |
| Validate attendance data before saving | `middleware/validate.js` (`validateMarkAttendance`, `validateUpdateAttendance`) |
| POST /attendance, GET /attendance/student/:id, GET /attendance/percentage/:studentId | `routes/attendanceRoutes.js` |
| References between collections | `Student.user → User`, `Course.teacher → User`, `Course.students → Student`, `Attendance.student/course/markedBy` |
| Postman collection | `backend/postman_collection.json` |
| MongoDB Atlas + `.env` config | `backend/.env.example`, section 8 above |
| React frontend: Login/Register, List/Dashboard, Add/Update form, Details page | `frontend/src/pages/*.jsx`, mapped in section 7 |
| Frontend calls REST API only, no business logic client-side | `frontend/src/api/axios.js` is the only place requests are made; no validation/percentage logic duplicated in React |
| Deployment (Render/Railway + Vercel/Netlify) | Section 10 above |
