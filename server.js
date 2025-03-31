const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
    origin: ['https://pleasantonstudentpro.com', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pleasantonstudentpro', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Post Schema
const PostSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: String,
    timestamp: { type: Date, default: Date.now },
    userId: String
});

const Post = mongoose.model('Post', PostSchema);

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

// Routes
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ timestamp: -1 });
        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const post = new Post(req.body);
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;
        const post = await Post.findOne({ _id: id, userId: userId });
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }
        
        await Post.deleteOne({ _id: id });
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
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
app.use(express.static(path.join(__dirname)));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 