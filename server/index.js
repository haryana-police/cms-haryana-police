import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import db from './db.js';
import hcReplyRoutes from './routes/hcReplyRoutes.js';

import fs from 'fs';
import path from 'path';

const app = express();
const logFile = fs.createWriteStream(path.join(process.cwd(), 'server-debug.log'), { flags: 'a' });
console.log = (...args) => {
  logFile.write(new Date().toISOString() + ' [LOG] ' + args.join(' ') + '\n');
  process.stdout.write(args.join(' ') + '\n');
};
console.error = (...args) => {
  logFile.write(new Date().toISOString() + ' [ERROR] ' + args.join(' ') + '\n');
  process.stderr.write(args.join(' ') + '\n');
};
const PORT = 3000;
const JWT_SECRET = 'local-dev-secret-haryana-police-123';

app.use(cors());
app.use(express.json());

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

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use('/api/hc-reply', authenticateToken, hcReplyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  // Handled Multer errors
  if (err.message && (err.message.includes('Only .pdf') || err.message.includes('too large'))) {
    return res.status(400).json({ success: false, error: err.message });
  }

  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal Server Error' 
  });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});

// Keep process alive and debug exits
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Dummy interval to keep event loop occupied if handles are missing
setInterval(() => {}, 100000);


