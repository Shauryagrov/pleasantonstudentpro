const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const app = express();

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

// CORS configuration - super permissive for debugging
app.use(cors({
    origin: '*', // Allow all origins for now
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Pre-flight CORS handler
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File path for storing posts
const POSTS_FILE = path.join('/tmp', 'posts.json');

// Initialize posts storage
async function initializeStorage() {
    try {
        await fs.access(POSTS_FILE);
    } catch {
        await fs.writeFile(POSTS_FILE, '[]');
    }
}

// Get all posts
async function getPosts() {
    try {
        const data = await fs.readFile(POSTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Save posts
async function savePosts(posts) {
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Routes
app.get('/api/posts', async (req, res) => {
    console.log('GET /api/posts - Request received');
    try {
        await initializeStorage();
        const posts = await getPosts();
        console.log(`GET /api/posts - Returning ${posts.length} posts`);
        res.json(posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/posts', async (req, res) => {
    console.log('POST /api/posts - Request received');
    try {
        await initializeStorage();
        const posts = await getPosts();
        const newPost = {
            id: Date.now().toString(),
            ...req.body,
            timestamp: new Date().toISOString()
        };
        posts.push(newPost);
        await savePosts(posts);
        console.log('POST /api/posts - Created new post:', newPost.id);
        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    console.log(`DELETE /api/posts/${req.params.id} - Request received`);
    try {
        await initializeStorage();
        const { id } = req.params;
        const { userId } = req.query;
        const posts = await getPosts();
        const postIndex = posts.findIndex(p => p.id === id && p.userId === userId);
        
        if (postIndex === -1) {
            console.log(`DELETE /api/posts/${id} - Post not found or unauthorized`);
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }
        
        posts.splice(postIndex, 1);
        await savePosts(posts);
        console.log(`DELETE /api/posts/${id} - Post deleted successfully`);
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('GET /api/health - Health check');
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