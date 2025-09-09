// Cấu hình CORS cho HealingMedicine API
const corsOptions = {
  // Các domain được phép truy cập API
  origin: function (origin, callback) {
    // Danh sách các domain được phép (whitelist)
    const allowedOrigins = [
      // Development environments
      'http://localhost:3000',     // React development
      'http://localhost:3001',     // React alternative port
      'http://localhost:5173',     // Vite development
      'http://localhost:8080',     // Vue development
      'http://localhost:4200',     // Angular development
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
      
      // Production domains (uncomment khi deploy)
      // 'https://healingmedicine.com',
      // 'https://www.healingmedicine.com',
      // 'https://admin.healingmedicine.com'
    ];

    // Development mode - cho phép tất cả origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Cho phép requests không có origin (mobile apps, Postman, Insomnia, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  // Các HTTP methods được phép
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  // Các headers được phép
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token',
    'X-API-Key',
    'X-User-Agent',
    'If-Modified-Since'
  ],
  
  // Cho phép gửi cookies và credentials
  credentials: true,
  
  // Cache preflight requests (giảm số requests OPTIONS)
  maxAge: 86400, // 24 hours
  
  // Expose headers cho client
  exposedHeaders: [
    'X-Total-Count', 
    'X-Page-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  
  // Thành công preflight request
  optionsSuccessStatus: 200 // Một số legacy browsers (IE11, various SmartTVs) choke on 204
};

module.exports = corsOptions;
