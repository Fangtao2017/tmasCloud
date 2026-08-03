const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/authenticate');
const {
  getMe,
  updateMe,
  changeMyPassword,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getUserSites,
  setUserSites,
} = require('../controllers/userController');

// ── Self-management (any authenticated user) ──────────────────────────────
router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/me/password', changeMyPassword);

// ── User management (admin + site_admin only) ─────────────────────────────
router.get('/', authorize('admin', 'site_admin'), listUsers);
router.post('/', authorize('admin', 'site_admin'), createUser);
router.patch('/:id', authorize('admin', 'site_admin'), updateUser);
router.delete('/:id', authorize('admin', 'site_admin'), deleteUser);
router.post('/:id/reset-password', authorize('admin', 'site_admin'), resetPassword);
router.get('/:id/sites', authorize('admin', 'site_admin'), getUserSites);
router.put('/:id/sites', authorize('admin', 'site_admin'), setUserSites);

module.exports = router;
