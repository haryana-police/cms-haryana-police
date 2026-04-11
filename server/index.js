import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import db from './db.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = 'local-dev-secret-haryana-police-123';

app.use(cors());
app.use(express.json());

import gdRoutes from './gdRoutes.js';
import preventiveRoutes from './preventiveRoutes.js';

app.use('/api/gd', gdRoutes);
app.use('/api/preventive', preventiveRoutes);

// Helper middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate an access token
  const token = jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      role: user.role
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );

  // Return user details without password
  const { password: _, ...userData } = user;
  
  res.json({
    token,
    user: userData
  });
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { password: _, ...userData } = user;
  res.json(userData);
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
