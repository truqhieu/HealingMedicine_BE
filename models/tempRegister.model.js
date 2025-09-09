const mongoose = require('mongoose');

const tempRegisterSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Vui lòng nhập họ tên'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Vui lòng nhập email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Vui lòng nhập mật khẩu']
  },
  role: {
    type: String,
    enum: ['Patient', 'Doctor', 'Admin'],
    default: 'Patient'
  },
  verificationToken: {
    type: String,
    required: true
  },
  tokenExpireAt: {
    type: Date,
    required: true,
    // Token sẽ tự động hết hạn sau 24 giờ
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // Document sẽ tự động bị xóa sau 24 giờ nếu không được xác thực
    expires: 86400 // 24 hours in seconds
  }
}, {
  timestamps: true
});

// Index để tự động xóa document hết hạn
tempRegisterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('TempRegister', tempRegisterSchema);
