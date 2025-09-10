const userService = require('../services/user.service');
const emailService = require('../services/email.service');
const TempRegister = require('../models/tempRegister.model');
const jwt = require('jsonwebtoken');

// Secret key cho JWT (trong production nên lưu trong environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

// Đăng ký tài khoản (gửi email xác thực)
const register = async (req, res) => {
  try {
    const { fullName, email, password, role = 'Patient' } = req.body;

    // Xử lý đăng ký qua service
    const { tempUser, verificationToken } = await userService.registerUser({
      fullName, email, password, role
    });

    // Tạo link xác thực với domain thực tế
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const verificationLink = emailService.createVerificationLink(verificationToken, email, baseUrl);

    // Gửi email xác thực
    try {
      await emailService.sendVerificationEmail(fullName, email, verificationLink);

      res.status(200).json({
        success: true,
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản',
        data: {
          email,
          message: 'Link xác thực đã được gửi đến email của bạn và có hiệu lực trong 24 giờ'
        }
      });

    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
      
      // Xóa tempUser nếu gửi email thất bại
      await TempRegister.deleteOne({ _id: tempUser._id });
      
      res.status(500).json({
        success: false,
        message: 'Không thể gửi email xác thực. Vui lòng thử lại sau',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    
    // Xử lý lỗi từ service (validation errors)
    if (error.message.includes('Vui lòng nhập') || 
        error.message.includes('Email không đúng') || 
        error.message.includes('Mật khẩu phải') ||
        error.message.includes('Email này đã được đăng ký')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Xác thực email
const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    // Xử lý xác thực email qua service
    const { user: newUser, token: jwtToken } = await userService.verifyEmail(token, email);

    // Trả về trang HTML thân thiện thay vì JSON
    const successHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác thực thành công - HealingMedicine</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            overflow: hidden;
            animation: slideUp 0.6s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px 30px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
          }
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .message {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 30px;
            line-height: 1.6;
          }
          .user-info {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #4f46e5;
          }
          .user-name {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 5px;
          }
          .user-email {
            color: #6b7280;
            font-size: 14px;
          }
          .next-steps {
            background: #ecfdf5;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #10b981;
          }
          .next-title {
            font-weight: 600;
            color: #065f46;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .next-text {
            color: #047857;
            font-size: 14px;
          }
          .footer {
            background: #f8fafc;
            padding: 25px;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 12px;
            margin: 5px 0;
          }
          .auto-close {
            color: #9ca3af;
            font-size: 11px;
            margin-top: 15px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">✅</div>
            <div class="title">Xác thực thành công!</div>
            <div class="subtitle">Chào mừng đến với HealingMedicine</div>
          </div>
          
          <div class="content">
            <div class="message">
              🎉 <strong>Chúc mừng!</strong> Tài khoản của bạn đã được xác thực và kích hoạt thành công.
            </div>
            
            <div class="user-info">
              <div class="user-name">👤 ${newUser.fullName}</div>
              <div class="user-email">${newUser.email}</div>
            </div>
            
            <div class="next-steps">
              <div class="next-title">🚀 Bước tiếp theo:</div>
              <div class="next-text">
                Bạn có thể đóng trang này và quay lại website để đăng nhập với tài khoản vừa được kích hoạt.
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-text">🏥 <strong>HealingMedicine</strong></div>
            <div class="footer-text">Hệ thống chăm sóc sức khỏe toàn diện</div>
            <div class="auto-close">Trang này sẽ tự động đóng sau 5 giây...</div>
          </div>
        </div>
      </body>
      </html>
    `;

    res.status(200).send(successHtml);

  } catch (error) {
    console.error('Lỗi xác thực email:', error);
    
    // Xử lý lỗi từ service (validation errors)
    if (error.message.includes('Thiếu thông tin') || 
        error.message.includes('Link xác thực không hợp lệ') || 
        error.message.includes('Link xác thực đã hết hạn')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Xử lý đăng nhập qua service
    const { user, token } = await userService.loginUser(email, password);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          phone: user.phone,
          address: user.address,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token
      }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    
    // Xử lý lỗi từ service (validation errors)
    if (error.message.includes('Vui lòng nhập') || 
        error.message.includes('Email hoặc mật khẩu không đúng') || 
        error.message.includes('Tài khoản của bạn đã bị khóa')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Lấy thông tin profile người dùng
const getProfile = async (req, res) => {
  try {
    // Lấy profile qua service
    const user = await userService.getUserProfile(req.user.userId);

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Lỗi lấy profile:', error);
    
    if (error.message.includes('Không tìm thấy thông tin người dùng')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware xác thực JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Lỗi xác thực token'
      });
    }
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  getProfile,
  authenticateToken,
};
