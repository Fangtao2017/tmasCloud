const bcrypt = require('bcryptjs');
const db = require('../db');

const SALT_ROUNDS = 12;

// ── GET /api/users/me ──────────────────────────────────────────────────────
async function getMe(req, res) {
  const { id } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT id, username, display_name, role, status, last_login FROM user_account WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const u = rows[0];
    let siteIds = null;
    if (u.role !== 'admin') {
      const [sr] = await db.query(
        `SELECT site_id FROM user_site_access WHERE user_id = ?`, [id]
      );
      siteIds = sr.map((r) => r.site_id);
    }
    return res.json({
      user: {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        role: u.role,
        status: u.status,
        lastLogin: u.last_login,
        siteIds,
      },
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── PATCH /api/users/me ────────────────────────────────────────────────────
async function updateMe(req, res) {
  const { id } = req.user;
  const { displayName } = req.body;
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ message: 'Display name is required' });
  }
  try {
    await db.query(
      `UPDATE user_account SET display_name = ?, updated_at = NOW() WHERE id = ?`,
      [displayName.trim(), id]
    );
    return res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── POST /api/users/me/password ────────────────────────────────────────────
async function changeMyPassword(req, res) {
  const { id } = req.user;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  try {
    const [rows] = await db.query(
      `SELECT password_hash FROM user_account WHERE id = ?`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      `UPDATE user_account SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [hash, id]
    );
    return res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('changeMyPassword error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── GET /api/users ─────────────────────────────────────────────────────────
// admin: all users; site_admin: their sub-users (created_by = me)
async function listUsers(req, res) {
  const { role, id } = req.user;
  try {
    let rows;
    if (role === 'admin') {
      [rows] = await db.query(`
        SELECT u.id, u.username, u.display_name, u.role, u.status,
               u.last_login, u.created_at, u.created_by,
               c.username AS created_by_username,
               c.display_name AS created_by_display_name
        FROM user_account u
        LEFT JOIN user_account c ON c.id = u.created_by
        ORDER BY u.created_at DESC
      `);
    } else {
      // site_admin
      [rows] = await db.query(`
        SELECT u.id, u.username, u.display_name, u.role, u.status,
               u.last_login, u.created_at, u.created_by
        FROM user_account u
        WHERE u.created_by = ?
        ORDER BY u.created_at DESC
      `, [id]);
    }

    // Attach site assignments for each user
    const userIds = rows.map((u) => u.id);
    const siteMap = {};
    if (userIds.length > 0) {
      const [siteRows] = await db.query(`
        SELECT usa.user_id, s.id AS site_id, s.name AS site_name
        FROM user_site_access usa
        JOIN site s ON s.id = usa.site_id
        WHERE usa.user_id IN (?)
      `, [userIds]);
      for (const sr of siteRows) {
        if (!siteMap[sr.user_id]) siteMap[sr.user_id] = [];
        siteMap[sr.user_id].push({ id: sr.site_id, name: sr.site_name });
      }
    }

    const users = rows.map((u) => ({ ...u, sites: siteMap[u.id] || [] }));
    return res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── POST /api/users ────────────────────────────────────────────────────────
async function createUser(req, res) {
  const { username, password, displayName, role: newRole, siteIds } = req.body;
  const { role: callerRole, id: callerId } = req.user;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const allowedRoles =
    callerRole === 'admin'
      ? ['admin', 'site_admin', 'operator', 'viewer']
      : ['operator', 'viewer'];

  if (!newRole || !allowedRoles.includes(newRole)) {
    return res.status(403).json({ message: `Cannot create role: ${newRole}` });
  }

  // site_admin can only assign sites they have access to
  if (callerRole === 'site_admin' && Array.isArray(siteIds) && siteIds.length > 0) {
    const [myS] = await db.query(
      `SELECT site_id FROM user_site_access WHERE user_id = ?`, [callerId]
    );
    const myIds = myS.map((r) => r.site_id);
    if (!siteIds.every((sid) => myIds.includes(sid))) {
      return res.status(403).json({ message: 'Cannot assign sites you do not have access to' });
    }
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdBy = callerRole === 'admin' ? null : callerId;

    const [result] = await db.query(`
      INSERT INTO user_account (username, display_name, password_hash, role, status, created_by)
      VALUES (?, ?, ?, ?, 'active', ?)
    `, [username.trim().toLowerCase(), (displayName || username).trim(), hash, newRole, createdBy]);

    const newId = result.insertId;

    if (Array.isArray(siteIds) && siteIds.length > 0) {
      const values = siteIds.map((sid) => [newId, sid]);
      await db.query(`INSERT INTO user_site_access (user_id, site_id) VALUES ?`, [values]);
    }

    return res.status(201).json({ id: newId, message: 'User created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    console.error('createUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── PATCH /api/users/:id ───────────────────────────────────────────────────
async function updateUser(req, res) {
  const targetId = parseInt(req.params.id, 10);
  const { role: callerRole, id: callerId } = req.user;
  const { displayName, role: newRole, status } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT id, role, created_by FROM user_account WHERE id = ?`, [targetId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const target = rows[0];

    if (callerRole === 'site_admin') {
      if (target.created_by !== callerId) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      if (newRole && !['operator', 'viewer'].includes(newRole)) {
        return res.status(403).json({ message: 'Cannot assign this role' });
      }
    }

    const updates = [];
    const params = [];
    if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
    if (newRole !== undefined) { updates.push('role = ?'); params.push(newRole); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(targetId);
    await db.query(
      `UPDATE user_account SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params
    );
    return res.json({ message: 'User updated' });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── DELETE /api/users/:id ──────────────────────────────────────────────────
// Soft delete: set status = 'inactive'
async function deleteUser(req, res) {
  const targetId = parseInt(req.params.id, 10);
  const { role: callerRole, id: callerId } = req.user;

  if (targetId === callerId) {
    return res.status(400).json({ message: 'Cannot deactivate your own account' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, created_by FROM user_account WHERE id = ?`, [targetId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    if (callerRole === 'site_admin' && rows[0].created_by !== callerId) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    await db.query(
      `UPDATE user_account SET status = 'inactive', updated_at = NOW() WHERE id = ?`, [targetId]
    );
    return res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── POST /api/users/:id/reset-password ────────────────────────────────────
async function resetPassword(req, res) {
  const targetId = parseInt(req.params.id, 10);
  const { role: callerRole, id: callerId } = req.user;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, created_by FROM user_account WHERE id = ?`, [targetId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    if (callerRole === 'site_admin' && rows[0].created_by !== callerId) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      `UPDATE user_account SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [hash, targetId]
    );
    return res.json({ message: 'Password reset' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── GET /api/users/:id/sites ───────────────────────────────────────────────
async function getUserSites(req, res) {
  const targetId = parseInt(req.params.id, 10);
  const { role: callerRole, id: callerId } = req.user;

  try {
    if (callerRole === 'site_admin') {
      const [rows] = await db.query(
        `SELECT created_by FROM user_account WHERE id = ?`, [targetId]
      );
      if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
      if (rows[0].created_by !== callerId) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
    }
    const [sites] = await db.query(`
      SELECT s.id, s.name
      FROM user_site_access usa
      JOIN site s ON s.id = usa.site_id
      WHERE usa.user_id = ?
    `, [targetId]);
    return res.json({ sites });
  } catch (err) {
    console.error('getUserSites error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ── PUT /api/users/:id/sites ───────────────────────────────────────────────
async function setUserSites(req, res) {
  const targetId = parseInt(req.params.id, 10);
  const { role: callerRole, id: callerId } = req.user;
  const { siteIds } = req.body;

  if (!Array.isArray(siteIds)) {
    return res.status(400).json({ message: 'siteIds must be an array' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, created_by FROM user_account WHERE id = ?`, [targetId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    if (callerRole === 'site_admin') {
      if (rows[0].created_by !== callerId) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      // Validate against fresh DB data (not stale JWT)
      const [myS] = await db.query(
        `SELECT site_id FROM user_site_access WHERE user_id = ?`, [callerId]
      );
      const myIds = myS.map((r) => r.site_id);
      if (!siteIds.every((sid) => myIds.includes(sid))) {
        return res.status(403).json({ message: 'Cannot assign sites you do not have access to' });
      }
    }

    await db.query(`DELETE FROM user_site_access WHERE user_id = ?`, [targetId]);
    if (siteIds.length > 0) {
      const values = siteIds.map((sid) => [targetId, sid]);
      await db.query(`INSERT INTO user_site_access (user_id, site_id) VALUES ?`, [values]);
    }
    return res.json({ message: 'Sites updated' });
  } catch (err) {
    console.error('setUserSites error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
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
};
