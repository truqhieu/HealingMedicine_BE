const TempRegister = require('../models/tempRegister.model');
const crypto = require('crypto');
const { createTransporter, getVerificationEmailTemplate } = require('../config/emailConfig');

// Gửi lại email xác thực
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    // Tìm user trong tempRegister
    const tempUser = await TempRegister.findOne({ email: email.toLowerCase() });

    if (!tempUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đăng ký cho email này'
      });
    }

    // Tạo token mới
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    
    // Cập nhật token và thời gian hết hạn
    tempUser.verificationToken = newVerificationToken;
    tempUser.tokenExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ
    await tempUser.save();

    // Tạo link xác thực mới
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${newVerificationToken}&email=${email}`;

    // Gửi email
    try {
      const transporter = createTransporter();
      const emailTemplate = getVerificationEmailTemplate(tempUser.fullName, verificationLink);

      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@healingmedicine.com',
        to: email,
        subject: '🔄 ' + emailTemplate.subject,
        html: emailTemplate.html
      });

      res.status(200).json({
        success: true,
        message: 'Email xác thực đã được gửi lại thành công',
        data: {
          email,
          message: 'Vui lòng kiểm tra email và nhấp vào link xác thực'
        }
      });

    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
      res.status(500).json({
        success: false,
        message: 'Không thể gửi email. Vui lòng thử lại sau',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (error) {
    console.error('Lỗi gửi lại email xác thực:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Kiểm tra trạng thái đăng ký
const checkRegistrationStatus = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    const tempUser = await TempRegister.findOne({ email: email.toLowerCase() });

    if (!tempUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đăng ký cho email này'
      });
    }

    const isExpired = tempUser.tokenExpireAt < new Date();

    res.status(200).json({
      success: true,
      data: {
        email: tempUser.email,
        fullName: tempUser.fullName,
        role: tempUser.role,
        isExpired,
        tokenExpireAt: tempUser.tokenExpireAt,
        createdAt: tempUser.createdAt,
        timeRemaining: isExpired ? 0 : Math.max(0, tempUser.tokenExpireAt - new Date())
      }
    });

  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Hủy đăng ký (xóa khỏi tempRegister)
const cancelRegistration = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    const result = await TempRegister.deleteOne({ email: email.toLowerCase() });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đăng ký cho email này'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã hủy yêu cầu đăng ký thành công'
    });

  } catch (error) {
    console.error('Lỗi hủy đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  resendVerificationEmail,
  checkRegistrationStatus,
  cancelRegistration
};
