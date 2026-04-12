import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { smartSearch, getSuggestions, detectLanguage } from './searchService.js';
import { syncEmbeddings } from './syncEmbeddings.js';

const app = express();
const PORT = 3001;
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

// --- Auth Routes ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const { password: _, ...userData } = user;
  res.json({ token, user: userData });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...userData } = user;
  res.json(userData);
});

// --- Search Routes ---

/**
 * Advanced Smart Search
 */
app.get('/api/search', authenticateToken, async (req, res) => {
  const { q, location, type, dateAfter } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const results = await smartSearch(q, { location, type, dateAfter });
    res.json({
      query: q,
      detected_language: detectLanguage(q),
      results: results,
      count: results.length
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Real-time Auto-suggestions
 */
app.get('/api/search/suggestions', authenticateToken, (req, res) => {
  const { q } = req.query;
  const suggestions = getSuggestions(q);
  res.json(suggestions);
});

/**
 * Mock Query Translation (Internal Use)
 */
app.post('/api/search/translate', authenticateToken, (req, res) => {
  const { q, target } = req.body;
  res.json({
    original: q,
    translated: q.includes('theft') ? 'चोरी' : q, 
    source: detectLanguage(q),
    target: target || 'english'
  });
});

app.listen(PORT, async () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
  
  // Initialize semantic search system
  try {
    await syncEmbeddings();
  } catch (err) {
    console.error('Failed to initialize semantic search:', err);
  }
});
