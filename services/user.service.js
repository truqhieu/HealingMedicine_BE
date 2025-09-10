const User = require('../models/user.model');
const TempRegister = require('../models/tempRegister.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secret key cho JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

class UserService {
  
  /**
   * Xử lý đăng ký user - Business Logic hoàn chỉnh
   */
  async registerUser(userData) {
    const { fullName, email, password, role = 'Patient' } = userData;

    // Validation
    if (!fullName || !email || !password) {
      throw new Error('Vui lòng nhập đầy đủ thông tin: họ tên, email và mật khẩu');
    }

    // Kiểm tra email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email không đúng định dạng');
    }

    // Kiểm tra độ dài password
    if (password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    // Kiểm tra email đã tồn tại trong users chưa
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('Email này đã được đăng ký');
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

    return { tempUser, verificationToken };
  }

  /**
   * Xử lý xác thực email - Business Logic hoàn chỉnh
   */
  async verifyEmail(token, email) {
    if (!token || !email) {
      throw new Error('Thiếu thông tin xác thực');
    }

    // Tìm user trong tempRegister
    const tempUser = await TempRegister.findOne({
      email: email.toLowerCase(),
      verificationToken: token
    });

    if (!tempUser) {
      throw new Error('Link xác thực không hợp lệ hoặc đã hết hạn');
    }

    // Kiểm tra token có hết hạn chưa
    if (tempUser.tokenExpireAt < new Date()) {
      await TempRegister.deleteOne({ _id: tempUser._id });
      throw new Error('Link xác thực đã hết hạn. Vui lòng đăng ký lại');
    }

    // Tạo user mới trong collection users
    // Sử dụng insertOne để bypass middleware hash (tránh hash lại password đã được hash)
    const userData = {
      fullName: tempUser.fullName,
      email: tempUser.email,
      passwordHash: tempUser.passwordHash,
      role: tempUser.role,
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await User.collection.insertOne(userData);
    const newUser = await User.findById(result.insertedId);

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

    return { user: newUser, token: jwtToken };
  }

  /**
   * Xử lý đăng nhập - Business Logic hoàn chỉnh
   */
  async loginUser(email, password) {
    // Validation
    if (!email || !password) {
      throw new Error('Vui lòng nhập email và mật khẩu');
    }

    // Tìm user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status !== 'Active') {
      throw new Error('Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt');
    }

    // Kiểm tra password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Email hoặc mật khẩu không đúng');
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

    return { user, token };
  }

  /**
   * Lấy profile user - Business Logic hoàn chỉnh
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId).select('-passwordHash');
    
    if (!user) {
      throw new Error('Không tìm thấy thông tin người dùng');
    }

    return user;
  }

  /**
   * Verify JWT token
   */
  verifyJWTToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  /**
   * Fix user password (development only)
   */
  async fixUserPassword(email, newPassword) {
    if (!email || !newPassword) {
      throw new Error('Vui lòng nhập email và newPassword');
    }

    // Chỉ hoạt động trong development mode
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Endpoint này chỉ khả dụng trong development mode');
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error('Không tìm thấy user với email này');
    }

    // Hash password mới
    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Cập nhật password trực tiếp vào database (bypass middleware)
    await User.collection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          passwordHash: newPasswordHash,
          updatedAt: new Date()
        }
      }
    );

    return user;
  }
}

module.exports = new UserService();