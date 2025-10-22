const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

const verifyToken = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    
    console.log('🔍 DEBUG verifyToken middleware:');
    console.log('   - URL:', req.originalUrl);
    console.log('   - Method:', req.method);
    console.log('   - Authorization header:', authHeader ? 'EXISTS' : 'MISSING');
    console.log('   - All headers:', JSON.stringify(req.headers, null, 2));
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No valid Authorization header found');
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục'
      });
    }

    const token = authHeader.split(' ')[1];
    
    console.log('   - Token extracted:', token ? 'YES' : 'NO');

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('   - Token decoded:', decoded);
    
    // Gắn thông tin user vào request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    console.log('   ✅ User info attached:', req.user);
    next();
  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'JsonWebTokenError') {
      console.error('❌ JWT Error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    if (error.name === 'TokenExpiredError') {
      console.error('❌ Token Expired:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực'
    });
  }
};

const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  verifyRole
};
