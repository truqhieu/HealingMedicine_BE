const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectMongo = require('./config/connectMongo');
const corsOptions = require('./config/corsConfig');
require('dotenv').config();

const app = express();

// Sử dụng cấu hình CORS từ file riêng

// Cấu hình middleware
app.use(morgan('combined')); // Hiển thị log HTTP requests chi tiết
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Giới hạn size request body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

connectMongo();

// Routes 
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to HealingMedicine API',
    version: '1.0.0',
    status: 'Server is running successfully'
  });
});

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.get('Origin') || 'No origin header',
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// API Routes
app.use('/api', require('./routes/index'));


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS Error: Origin not allowed',
      origin: req.get('Origin'),
      error: 'This domain is not authorized to access this API'
    });
  }
  
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler - phải đặt cuối cùng
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Cấu hình port
const PORT = process.env.PORT || 9999;

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 HealingMedicine API is ready to server`);
});