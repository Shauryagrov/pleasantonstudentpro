const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request rate limiting - in-memory store for demo purposes
// In production, use Redis or another distributed store
const requestLimits = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_IP = 5; // 5 requests per IP per minute
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const ip in requestLimits) {
        if (now - requestLimits[ip].timestamp > RATE_LIMIT_WINDOW) {
            delete requestLimits[ip];
        }
    }
}, RATE_LIMIT_CLEANUP_INTERVAL);

// Middleware for rate limiting AI requests
function rateLimitMiddleware(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    
    if (!requestLimits[ip]) {
        requestLimits[ip] = {
            count: 1,
            timestamp: now
        };
        return next();
    }
    
    // Reset counter if outside the window
    if (now - requestLimits[ip].timestamp > RATE_LIMIT_WINDOW) {
        requestLimits[ip] = {
            count: 1,
            timestamp: now
        };
        return next();
    }
    
    // Increment count if within window
    requestLimits[ip].count++;
    
    // Check if limit exceeded
    if (requestLimits[ip].count > MAX_REQUESTS_PER_IP) {
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((requestLimits[ip].timestamp + RATE_LIMIT_WINDOW - now) / 1000)
        });
    }
    
    next();
}

// Content moderation - profanity filter
const profanityList = [
    'ass', 'asshole', 'bitch', 'cunt', 'damn', 'fuck', 'fucking', 'shit', 
    'dick', 'cock', 'pussy', 'nigger', 'nigga', 'piss', 'bastard', 
    'whore', 'slut', 'bullshit', 'crap', 'hell', 'twat'
];

// Function to check content for profanity
function containsProfanity(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    
    for (const word of profanityList) {
        const regex = new RegExp(`\\b${word}\\b|\\b${word}s\\b|\\b${word}ed\\b|\\b${word}ing\\b`, 'i');
        if (regex.test(lowerText)) {
            return true;
        }
    }
    return false;
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
const postsFile = path.join(dataDir, 'posts.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize posts as an array
let posts = [];

// Load existing posts or initialize empty array
try {
    if (fs.existsSync(postsFile)) {
        const data = fs.readFileSync(postsFile, 'utf8');
        posts = JSON.parse(data);
        console.log(`Loaded ${posts.length} posts from storage`);
    } else {
        // Create initial file with empty array
        fs.writeFileSync(postsFile, JSON.stringify(posts), 'utf8');
        console.log('Created empty posts file');
    }
} catch (error) {
    console.error('Error loading posts:', error);
    // Ensure posts is an array in case of error
    posts = [];
}

// Save posts to file
function savePosts() {
    try {
        fs.writeFileSync(postsFile, JSON.stringify(posts), 'utf8');
        console.log(`Saved ${posts.length} posts to storage`);
        return true;
    } catch (error) {
        console.error('Error saving posts:', error);
        return false;
    }
}

// API endpoints for posts
app.get('/api/posts', (req, res) => {
    console.log('GET /api/posts - Sending', posts.length, 'posts');
    res.json(posts);
});

app.post('/api/posts', (req, res) => {
    try {
        console.log('POST /api/posts - Received new post request');
        
        if (!req.body || !req.body.name || !req.body.post) {
            console.error('Invalid post data:', req.body);
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check for inappropriate content
        if (containsProfanity(req.body.post)) {
            console.error('Post contains inappropriate content');
            return res.status(400).json({ error: 'Post contains inappropriate content that violates community guidelines' });
        }
        
        const newPost = {
            id: Date.now().toString(),
            ...req.body,
            timestamp: new Date().toISOString()
        };
        
        console.log('Created new post:', newPost.id);
        
        // Ensure posts is initialized as an array
        if (!Array.isArray(posts)) {
            console.log('Initializing posts as an array');
            posts = [];
        }
        
        // Add to beginning of array
        posts.unshift(newPost);
        
        const saved = savePosts();
        if (!saved) {
            return res.status(500).json({ error: 'Failed to save post' });
        }
        
        console.log('Sending new post in response');
        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Server error creating post' });
    }
});

// Delete post endpoint
app.delete('/api/posts/:id', (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.query.userId;
        console.log(`DELETE /api/posts/${postId} by user ${userId}`);
        
        // Ensure posts is an array
        if (!Array.isArray(posts)) {
            posts = [];
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Find the post
        const postIndex = posts.findIndex(post => post.id === postId);
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Check ownership (if userId is provided)
        if (userId && posts[postIndex].userId && posts[postIndex].userId !== userId) {
            console.log('Delete rejected: User does not own this post');
            return res.status(403).json({ error: 'You do not have permission to delete this post' });
        }
        
        // Remove the post
        posts = posts.filter(post => post.id !== postId);
        
        const saved = savePosts();
        if (!saved) {
            return res.status(500).json({ error: 'Failed to save after delete' });
        }
        
        console.log('Post deleted successfully');
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Server error deleting post' });
    }
});

// Server-side API endpoint for AI requests to handle rate limiting 
// and provide better error handling
app.post('/api/ai/generate', rateLimitMiddleware, async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAkkTVjbQ9Uv2DxLA6m4swvl-KdHOavYdA';
        
        if (!req.body || !req.body.contents) {
            return res.status(400).json({ 
                error: 'Invalid request',
                message: 'Missing required fields in the request body' 
            });
        }
        
        // Check for profanity in text inputs
        const userMessage = req.body.contents[0]?.parts?.find(part => part.text)?.text;
        if (userMessage && containsProfanity(userMessage)) {
            console.log('AI request contains profanity, rejecting');
            return res.status(400).json({
                error: 'Content policy violation',
                message: 'Your message contains inappropriate content. Please try again with appropriate language.'
            });
        }
        
        // Make the actual request to Gemini API
        console.log('Making AI request to Gemini API');
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
            req.body,
            { 
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 // 30 second timeout
            }
        );
        
        console.log('AI response received, status:', response.status);
        
        // Return the AI response
        return res.status(200).json(response.data);
    } catch (error) {
        console.error('Error in AI request:', error.message);
        
        // Handle various error cases
        if (error.response) {
            // The request was made and the server responded with a status code
            const status = error.response.status;
            const errorData = error.response.data;
            
            console.error(`AI API error: ${status}`, errorData);
            
            if (status === 429) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'The AI service is currently experiencing high demand. Please try again in a few moments.',
                    retryAfter: 10
                });
            }
            
            // Pass through the error from the API
            return res.status(status).json({
                error: 'AI service error',
                message: errorData.error?.message || 'The AI service encountered an error',
                details: errorData
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from AI API');
            return res.status(504).json({
                error: 'Gateway timeout',
                message: 'The AI service did not respond in time. Please try again.'
            });
        } else {
            // Something happened in setting up the request
            return res.status(500).json({
                error: 'Server error',
                message: 'An unexpected error occurred while processing your request.'
            });
        }
    }
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`  - Local:   http://localhost:${port}`);
    console.log(`  - Network: http://${require('os').hostname()}:${port}`);
}); 