const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
};

// ── POST /auth/login ─────────────────────────────────────
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, username, password_hash, role, status, display_name
       FROM user_account WHERE username = ? LIMIT 1`,
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      // Generic message to avoid username enumeration
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive. Contact your administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Get allowed site IDs (admin gets null = all sites)
    let siteIds = null;
    if (user.role !== 'admin') {
      const [siteRows] = await db.query(
        `SELECT site_id FROM user_site_access WHERE user_id = ?`,
        [user.id]
      );
      siteIds = siteRows.map((r) => r.site_id);
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, displayName: user.display_name || user.username, role: user.role, siteIds },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Update last_login
    await db.query(`UPDATE user_account SET last_login = NOW() WHERE id = ?`, [user.id]);

    res.cookie('token', token, COOKIE_OPTIONS);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        role: user.role,
        siteIds,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── POST /auth/logout ────────────────────────────────────
function logout(req, res) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  return res.json({ message: 'Logged out' });
}

// ── GET /auth/me ─────────────────────────────────────────
// Returns current user info from the verified JWT (req.user set by authenticate middleware)
function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, logout, me };
