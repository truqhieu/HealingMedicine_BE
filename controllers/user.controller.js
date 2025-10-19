const userService = require('../services/user.service');
const emailService = require('../services/email.service');
const TempRegister = require('../models/tempRegister.model');
const jwt = require('jsonwebtoken');


// Secret key cho JWT (trong production nên lưu trong environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

// Đăng ký tài khoản (gửi email xác thực)
const register = async (req, res) => {
  try {
    const { fullName, email, gender, dateOfBirth, password } = req.body;

    // Validation cơ bản cho các trường bắt buộc
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin bắt buộc'
      });
    }

    // Validation các trường cơ bản
    // Lưu ý: confirmPassword sẽ được validate ở Frontend trước khi gửi API

    // Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Kiểm tra email format (để tăng security)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không đúng định dạng'
      });
    }

    // Xử lý đăng ký qua service (role sẽ được set default = 'Patient' trong service)
    const { tempUser, verificationToken } = await userService.registerUser({
      fullName, email, password, gender, dateOfBirth
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
          fullName,
          role: tempUser.role,
          message: 'Link xác thực đã được gửi đến email của bạn và có hiệu lực trong 24 giờ',
          expiresAt: tempUser.tokenExpireAt
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
        error.message.includes('Email này đã được đăng ký') ||
        error.message.includes('Mật khẩu và xác nhận mật khẩu không khớp')) {
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

const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    const { user: newUser, token: jwtToken } = await userService.verifyEmail(token, email);

    res.status(200).json({
      success: true,
      message: 'Xác thực email thành công! Tài khoản đã được kích hoạt.',
      data: {
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
          gender: newUser.gender,
          dob: newUser.dob
        },
        token: jwtToken
      }
    });

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
