const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://pleasantonstudentpro.com', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create posts table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        role TEXT,
        grade TEXT,
        school TEXT,
        post TEXT,
        image TEXT,
        userId TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Routes
app.get('/api/posts', (req, res) => {
    db.all('SELECT * FROM posts ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(rows);
    });
});

app.post('/api/posts', (req, res) => {
    const { name, role, grade, school, post, image, userId } = req.body;
    
    db.run(
        'INSERT INTO posts (name, role, grade, school, post, image, userId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, role, grade, school, post, image, userId],
        function(err) {
            if (err) {
                console.error('Error creating post:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            // Get the created post
            db.get('SELECT * FROM posts WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    console.error('Error fetching created post:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(201).json(row);
            });
        }
    );
});

app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;
    
    db.run(
        'DELETE FROM posts WHERE id = ? AND userId = ?',
        [id, userId],
        function(err) {
            if (err) {
                console.error('Error deleting post:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Post not found or unauthorized' });
            }
            
            res.status(200).json({ message: 'Post deleted successfully' });
        }
    );
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Export the Express API
module.exports = app;

// Only listen if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
} 