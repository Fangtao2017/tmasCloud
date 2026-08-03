/**
 * Create the first admin account.
 *
 * Usage (run from tmas-backend folder):
 *   node scripts/createAdmin.js <username> <password> [displayName]
 *
 * Example:
 *   node scripts/createAdmin.js admin "<strong-unique-password>" "System Admin"
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

async function main() {
  const [,, username, password, displayName] = process.argv;

  if (!username || !password) {
    console.error('Usage: node scripts/createAdmin.js <username> <password> [displayName]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    // Check if username already exists
    const [existing] = await db.query(
      'SELECT id FROM user_account WHERE username = ? LIMIT 1',
      [username.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      console.error(`User "${username}" already exists.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO user_account (username, password_hash, role, status, display_name, created_at, updated_at)
       VALUES (?, ?, 'admin', 'active', ?, NOW(), NOW())`,
      [username.trim().toLowerCase(), hash, displayName || username]
    );

    console.log(`✓ Admin account created.`);
    console.log(`  ID:       ${result.insertId}`);
    console.log(`  Username: ${username.trim().toLowerCase()}`);
    console.log(`  Role:     admin`);

    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  }
}

main();
