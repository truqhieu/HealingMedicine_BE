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

// Template email xác thực
const getVerificationEmailTemplate = (fullName, verificationLink) => {
  return {
    subject: '🏥 Xác thực tài khoản HealingMedicine',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Xác thực tài khoản</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover {
            background: #5a6fd8;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏥 HealingMedicine</h1>
          <p>Chào mừng bạn đến với hệ thống chăm sóc sức khỏe</p>
        </div>
        <div class="content">
          <h2>Xin chào ${fullName}!</h2>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại HealingMedicine. Để hoàn tất quá trình đăng ký, vui lòng xác thực email của bạn bằng cách nhấp vào nút bên dưới:</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">
              ✅ Xác thực tài khoản
            </a>
          </div>
          
          <p><strong>Lưu ý quan trọng:</strong></p>
          <ul>
            <li>Link xác thực này chỉ có hiệu lực trong vòng 24 giờ</li>
            <li>Sau khi xác thực thành công, bạn có thể đăng nhập vào hệ thống</li>
            <li>Nếu bạn không thực hiện xác thực, tài khoản sẽ bị xóa tự động</li>
          </ul>
          
          <p>Nếu bạn không thể nhấp vào nút, hãy copy và paste link sau vào trình duyệt:</p>
          <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">
            ${verificationLink}
          </p>
          
          <p>Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
        </div>
        <div class="footer">
          <p>© 2024 HealingMedicine. Tất cả quyền được bảo lưu.</p>
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
        </div>
      </body>
      </html>
    `
  };
};

module.exports = {
  createTransporter,
  getVerificationEmailTemplate
};
