// Backend API server for Hostinger VPS (Node.js + Express).
// This service replaces Supabase auth/logic with a custom REST API backed by PostgreSQL.
//
// Env vars needed:
//   DATABASE_URL   - Postgres connection string (Hostinger DB)
//   PORT           - Port to listen on (default 4000)
//   JWT_SECRET     - Secret key for signing JWTs

/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const postgres = require('postgres');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required for backend server.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 10,
});

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Helper: create JWT for a user
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// Helper: auth middleware for protected routes
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token =
    (authHeader.startsWith('Bearer ') && authHeader.slice(7)) ||
    req.cookies['access_token'];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'error', message: 'DB not reachable' });
  }
});

// --- Auth endpoints ---

// Login: expects { email, password }
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Example users table: users(id, email, password_hash, role, school_id, created_at)
    const users = await sql/* sql */`
      SELECT id, email, password_hash, role, school_id
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({
      sub: user.id,
      role: user.role,
      school_id: user.school_id,
    });

    res
      .cookie('access_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000,
      })
      .json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          school_id: user.school_id,
        },
      });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example protected route mirroring /api/profile
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;

    const profiles = await sql/* sql */`
      SELECT id, full_name, email, role, school_id
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!profiles.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: profiles[0] });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example student dashboard endpoint (very minimal, to be extended)
app.get('/student/dashboard', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const studentId = req.user.sub;

    const courses = await sql/* sql */`
      SELECT c.id, c.name, c.title, c.status
      FROM student_courses sc
      JOIN courses c ON c.id = sc.course_id
      WHERE sc.student_id = ${studentId}
        AND sc.is_completed = false
    `;

    res.json({
      studentId,
      courses,
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler (fallback)
app.use((err, req, res, _next) => {
  console.error('Unhandled backend error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend API server listening on port ${PORT}`);
});

