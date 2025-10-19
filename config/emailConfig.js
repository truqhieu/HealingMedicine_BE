const nodemailer = require('nodemailer');

// Cấu hình email transporter với App Password
const createTransporter = () => {
  // Kiểm tra biến môi trường
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('⚠️ Thiếu EMAIL_USER hoặc EMAIL_PASSWORD trong file .env');
    throw new Error('Email configuration missing');
  }

  console.log('📧 Tạo email transporter với:', process.env.EMAIL_USER);

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Template email xác thực - Chuyên nghiệp & Đẹp mắt
const getVerificationEmailTemplate = (fullName, verificationLink) => {
  return {
    subject: `Xác thực tài khoản HealingMedicine`,
    text: `
Xin chào ${fullName}!

Để hoàn tất đăng ký, vui lòng nhấp vào link:
${verificationLink}

Link có hiệu lực trong 24 giờ.

HealingMedicine Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        🏥 HealingMedicine
      </h1>
      <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px; opacity: 0.9;">
        Hệ thống chăm sóc sức khỏe
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">
        Xin chào ${fullName}! 👋
      </h2>
      
      <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Chào mừng bạn đến với <strong style="color: #4f46e5;">HealingMedicine</strong>!<br>
        Để hoàn tất đăng ký tài khoản, vui lòng xác thực email của bạn.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${verificationLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: transform 0.2s;">
          ✅ Xác thực tài khoản
        </a>
      </div>
      
      <!-- Info Box -->
      <div style="background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 18px; margin-right: 8px;">⏰</span>
          <strong style="color: #1e293b; font-size: 14px;">Quan trọng</strong>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
          Link xác thực có hiệu lực trong <strong style="color: #dc2626;">24 giờ</strong>. 
          Sau khi xác thực, bạn có thể đăng nhập và sử dụng hệ thống.
        </p>
      </div>
      
      <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">
        HealingMedicine Team
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Email tự động • Không trả lời
      </p>
    </div>
    
  </div>
</body>
</html>
    `.trim()
  };
};

module.exports = {
  createTransporter,
  getVerificationEmailTemplate
};
