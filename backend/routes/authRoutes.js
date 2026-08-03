const express = require('express');
const router = express.Router();
const { login, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

// Public
router.post('/login', login);
router.post('/logout', logout);

// Protected — requires valid JWT cookie
router.get('/me', authenticate, me);

module.exports = router;
