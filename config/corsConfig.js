const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',     
      'http://localhost:3001',     
      'http://localhost:5173',     
      'http://localhost:8080',     
      'http://localhost:4200',     
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
      

    ];

    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(` CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
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
  
  credentials: true,
  
  maxAge: 86400, 
  
  exposedHeaders: [
    'X-Total-Count', 
    'X-Page-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  
  optionsSuccessStatus: 200 
};

module.exports = corsOptions;
