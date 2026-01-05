import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Initialize database
const db = new sqlite3.Database(join(__dirname, 'database.db'));

// Initialize tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Graphs table
  db.run(`CREATE TABLE IF NOT EXISTS graphs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT,
    config TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    share_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Shared graphs (for user-to-user sharing)
  db.run(`CREATE TABLE IF NOT EXISTS shared_graphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id TEXT NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    shared_by_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (graph_id) REFERENCES graphs(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(graph_id, shared_with_user_id)
  )`);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_graphs_user ON graphs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_graphs_share_token ON graphs(share_token)`);
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ===== AUTH ROUTES =====

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email.toLowerCase(), passwordHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email already registered' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: this.lastID, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  db.get(
    'SELECT * FROM users WHERE email = ?',
    [email.toLowerCase()],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email: user.email } });
    }
  );
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  });
});

// ===== GRAPH ROUTES =====

// Get all graphs for user
app.get('/api/graphs', authenticateToken, (req, res) => {
  db.all(
    `SELECT g.*, 
     (SELECT COUNT(*) FROM shared_graphs WHERE graph_id = g.id) as share_count
     FROM graphs g 
     WHERE g.user_id = ? OR g.id IN (
       SELECT graph_id FROM shared_graphs WHERE shared_with_user_id = ?
     )
     ORDER BY g.updated_at DESC`,
    [req.user.userId, req.user.userId],
    (err, graphs) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch graphs' });
      }
      res.json({ graphs: graphs.map(g => ({
        ...g,
        config: JSON.parse(g.config),
        is_public: g.is_public === 1
      })) });
    }
  );
});

// Get single graph
app.get('/api/graphs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT * FROM graphs 
     WHERE id = ? AND (user_id = ? OR is_public = 1 OR id IN (
       SELECT graph_id FROM shared_graphs WHERE graph_id = ? AND shared_with_user_id = ?
     ))`,
    [id, req.user.userId, id, req.user.userId],
    (err, graph) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      if (!graph) {
        return res.status(404).json({ error: 'Graph not found' });
      }
      res.json({
        ...graph,
        config: JSON.parse(graph.config),
        is_public: graph.is_public === 1
      });
    }
  );
});

// Create graph
app.post('/api/graphs', authenticateToken, (req, res) => {
  const { name, config } = req.body;
  console.log('Create graph request:', { name, hasConfig: !!config, userId: req.user.userId });
  
  if (!config) {
    console.error('Create graph error: config required');
    return res.status(400).json({ error: 'Graph config required' });
  }

  const id = uuidv4();
  const shareToken = uuidv4();

  db.run(
    'INSERT INTO graphs (id, user_id, name, config, share_token) VALUES (?, ?, ?, ?, ?)',
    [id, req.user.userId, name || 'Untitled Graph', JSON.stringify(config), shareToken],
    function(err) {
      if (err) {
        console.error('Database error creating graph:', err);
        return res.status(500).json({ error: 'Failed to create graph', message: err.message });
      }
      console.log('Graph created successfully:', id);
      res.json({ id, shareToken, message: 'Graph saved successfully' });
    }
  );
});

// Update graph
app.put('/api/graphs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, config, is_public } = req.body;
  console.log('Update graph request:', { id, name, hasConfig: !!config, userId: req.user.userId });

  // Check ownership
  db.get('SELECT user_id FROM graphs WHERE id = ?', [id], (err, graph) => {
    if (err) {
      console.error('Database error checking graph:', err);
      return res.status(500).json({ error: 'Database error', message: err.message });
    }
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    if (graph.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(config));
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }
    
    // Always update the timestamp, even if no other fields changed
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    // Always execute the UPDATE to refresh updated_at timestamp
    db.run(
      `UPDATE graphs SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          console.error('Database error updating graph:', err);
          return res.status(500).json({ error: 'Failed to update graph', message: err.message });
        }
        console.log('Graph updated successfully:', id);
        res.json({ id, message: 'Graph updated successfully' });
      }
    );
  });
});

// Delete graph
app.delete('/api/graphs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.get('SELECT user_id FROM graphs WHERE id = ?', [id], (err, graph) => {
    if (err || !graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    if (graph.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.run('DELETE FROM graphs WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete graph' });
      }
      res.json({ message: 'Graph deleted successfully' });
    });
  });
});

// Share graph with user
app.post('/api/graphs/:id/share', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  // Get graph and verify ownership
  db.get('SELECT user_id FROM graphs WHERE id = ?', [id], (err, graph) => {
    if (err || !graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    if (graph.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find user to share with
    db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, targetUser) => {
      if (err || !targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.id === req.user.userId) {
        return res.status(400).json({ error: 'Cannot share with yourself' });
      }

      db.run(
        'INSERT OR IGNORE INTO shared_graphs (graph_id, shared_with_user_id, shared_by_user_id) VALUES (?, ?, ?)',
        [id, targetUser.id, req.user.userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to share graph' });
          }
          res.json({ message: 'Graph shared successfully' });
        }
      );
    });
  });
});

// Create or get shareable link (must be before /api/graphs/:id routes to avoid conflicts)
app.post('/api/graphs/:id/share-link', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Get graph and verify ownership
  db.get('SELECT share_token, is_public FROM graphs WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, graph) => {
    if (err) {
      console.error('Database error in share-link:', err);
      return res.status(500).json({ error: 'Database error', message: err.message });
    }
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    // If no share token exists, create one
    if (!graph.share_token) {
      const shareToken = uuidv4();
      db.run('UPDATE graphs SET share_token = ?, is_public = 1 WHERE id = ?', [shareToken, id], (updateErr) => {
        if (updateErr) {
          console.error('Failed to update graph with share token:', updateErr);
          return res.status(500).json({ error: 'Failed to create share link', message: updateErr.message });
        }
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        res.json({
          shareToken: shareToken,
          isPublic: true,
          shareUrl: `${frontendUrl}?share=${shareToken}`
        });
      });
    } else {
      // Share token already exists, just return it
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
      res.json({
        shareToken: graph.share_token,
        isPublic: graph.is_public === 1,
        shareUrl: `${frontendUrl}?share=${graph.share_token}`
      });
    }
  });
});

// Get shareable link (GET method for compatibility)
app.get('/api/graphs/:id/share-link', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.get('SELECT share_token, is_public FROM graphs WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, graph) => {
    if (err || !graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    if (!graph.share_token) {
      return res.status(404).json({ error: 'Share link not created. Use POST to create one.' });
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.json({
      shareToken: graph.share_token,
      isPublic: graph.is_public === 1,
      shareUrl: `${frontendUrl}?share=${graph.share_token}`
    });
  });
});

// Get graph by share token (public access) - must be after /share-link routes
app.get('/api/graphs/share/:token', (req, res) => {
  const { token } = req.params;
  db.get('SELECT * FROM graphs WHERE share_token = ? AND is_public = 1', [token], (err, graph) => {
    if (err || !graph) {
      return res.status(404).json({ error: 'Graph not found or not public' });
    }
    res.json({
      ...graph,
      config: JSON.parse(graph.config),
      is_public: true
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

