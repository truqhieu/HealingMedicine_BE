const User = require('../models/user.model');
const TempRegister = require('../models/tempRegister.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createTransporter, getVerificationEmailTemplate } = require('../config/emailConfig');

// Secret key cho JWT (trong production nên lưu trong environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Đăng ký tài khoản (gửi email xác thực)
const register = async (req, res) => {
  try {
    const { fullName, email, password, role = 'Patient' } = req.body;

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin: họ tên, email và mật khẩu'
      });
    }

    // Kiểm tra email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không đúng định dạng'
      });
    }

    // Kiểm tra độ dài password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Kiểm tra email đã tồn tại trong users chưa
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được đăng ký'
      });
    }

    // Kiểm tra email đã tồn tại trong tempRegister chưa
    const existingTempUser = await TempRegister.findOne({ email: email.toLowerCase() });
    if (existingTempUser) {
      // Xóa bản ghi cũ để tạo mới
      await TempRegister.deleteOne({ email: email.toLowerCase() });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Tạo verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Lưu vào tempRegister
    const tempUser = new TempRegister({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role,
      verificationToken
    });

    await tempUser.save();

    // Tạo link xác thực
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}&email=${email}`;

    // Gửi email xác thực
    try {
      const transporter = createTransporter();
      const emailTemplate = getVerificationEmailTemplate(fullName, verificationLink);

      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@healingmedicine.com',
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      });

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

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin xác thực'
      });
    }

    // Tìm user trong tempRegister
    const tempUser = await TempRegister.findOne({
      email: email.toLowerCase(),
      verificationToken: token
    });

    if (!tempUser) {
      return res.status(400).json({
        success: false,
        message: 'Link xác thực không hợp lệ hoặc đã hết hạn'
      });
    }

    // Kiểm tra token có hết hạn chưa
    if (tempUser.tokenExpireAt < new Date()) {
      await TempRegister.deleteOne({ _id: tempUser._id });
      return res.status(400).json({
        success: false,
        message: 'Link xác thực đã hết hạn. Vui lòng đăng ký lại'
      });
    }

    // Tạo user mới trong collection users
    const newUser = new User({
      fullName: tempUser.fullName,
      email: tempUser.email,
      passwordHash: tempUser.passwordHash,
      role: tempUser.role
    });

    await newUser.save();

    // Xóa tempUser sau khi tạo user thành công
    await TempRegister.deleteOne({ _id: tempUser._id });

    // Tạo JWT token
    const jwtToken = jwt.sign(
      { 
        userId: newUser._id,
        email: newUser.email,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.status(200).json({
      success: true,
      message: 'Xác thực email thành công! Tài khoản của bạn đã được kích hoạt',
      data: {
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
          createdAt: newUser.createdAt
        },
        token: jwtToken
      }
    });

  } catch (error) {
    console.error('Lỗi xác thực email:', error);
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // Tìm user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt'
      });
    }

    // Kiểm tra password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Cập nhật thời gian đăng nhập cuối
    user.updatedAt = new Date();
    await user.save();

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
    const user = await User.findById(req.user.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin người dùng'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Lỗi lấy profile:', error);
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
  authenticateToken
};
