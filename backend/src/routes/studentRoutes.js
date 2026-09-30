const express = require('express');
const { listStudents } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('teacher'), listStudents);

module.exports = router;
