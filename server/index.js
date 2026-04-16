import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import prisma from './prisma.js';
import { seedProfiles } from './seed.js';
import gdRoutes from './gdRoutes.js';
import preventiveRoutes from './preventiveRoutes.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = 'local-dev-secret-haryana-police-123';

app.use(cors());
app.use(express.json());

app.use('/api/gd', gdRoutes);
app.use('/api/preventive', preventiveRoutes);

// ── Auth middleware ──────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ── POST /api/login ──────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await prisma.profile.findUnique({ where: { username } });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return without password, map camelCase → snake_case for frontend compatibility
    const { password: _, ...rest } = user;
    res.json({
      token,
      user: {
        ...rest,
        full_name:    rest.fullName,
        badge_number: rest.badgeNumber,
        station_id:   rest.stationId,
        created_at:   rest.createdAt,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.profile.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password: _, ...rest } = user;
    res.json({
      ...rest,
      full_name:    rest.fullName,
      badge_number: rest.badgeNumber,
      station_id:   rest.stationId,
      created_at:   rest.createdAt,
    });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── Startup ──────────────────────────────────────────────────
async function start() {
  await seedProfiles();
  app.listen(PORT, () => {
    console.log(`[server] Backend API running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
