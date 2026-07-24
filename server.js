const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const db = require('./database/db');

const app = express();
const PORT = process.process?.env?.PORT || process.env.PORT || 5000;

// Enable trust proxy for reverse proxy platforms like Railway, Heroku, Vercel
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({

  crossOriginResourcePolicy: false, // Allow frontend to request uploads/ images
}));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads folder as static files
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/payment', require('./routes/payments'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Base route health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Baehive Club Backend running on http://localhost:${PORT}`);
});
