const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: verify JWT from HttpOnly cookie.
 * Attaches req.user = { id, username, role, siteIds } on success.
 * siteIds is null for admin (meaning access to all sites).
 */
function authenticate(req, res, next) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set in environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      username: payload.username,
      displayName: payload.displayName || payload.username,
      role: payload.role,
      siteIds: payload.siteIds ?? null, // null = admin (all sites)
    };
    next();
  } catch (err) {
    // Clear invalid/expired cookie
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

/**
 * Middleware: require one of the listed roles.
 * Must be used after authenticate().
 * Usage: authorize('admin') or authorize('admin', 'engineer')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
