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

// Template email xác thực chuyên nghiệp
const getVerificationEmailTemplate = (fullName, verificationLink) => {
  return {
    subject: '🏥 Xác thực tài khoản HealingMedicine - Chào mừng bạn!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác thực tài khoản HealingMedicine</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f7fa;
            padding: 20px;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 22px;
            color: #1f2937;
            margin-bottom: 20px;
            font-weight: 600;
          }
          .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 30px;
          }
          .cta-container {
            text-align: center;
            margin: 35px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
          }
          .info-box {
            background: #f8fafc;
            border-left: 4px solid #4f46e5;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
          }
          .info-title {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .info-list {
            color: #4b5563;
            font-size: 14px;
          }
          .info-list li {
            margin-bottom: 5px;
          }
          .backup-link {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            color: #64748b;
          }
          .backup-url {
            word-break: break-all;
            background: white;
            padding: 10px;
            border-radius: 4px;
            margin-top: 8px;
            border: 1px solid #e2e8f0;
            font-family: monospace;
            font-size: 12px;
          }
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .disclaimer {
            font-size: 14px;
            color: #6b7280;
            margin-top: 20px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="logo">🏥 HealingMedicine</div>
            <div class="header-subtitle">Hệ thống chăm sóc sức khỏe toàn diện</div>
          </div>
          
          <div class="content">
            <div class="greeting">Xin chào ${fullName}!</div>
            
            <div class="message">
              Chào mừng bạn đến với <strong>HealingMedicine</strong>! Chúng tôi rất vui mừng khi bạn quyết định tham gia cộng đồng chăm sóc sức khỏe của chúng tôi.
            </div>
            
            <div class="message">
              Để bảo mật tài khoản và hoàn tất quá trình đăng ký, vui lòng xác thực địa chỉ email của bạn bằng cách nhấp vào nút bên dưới:
            </div>
            
            <div class="cta-container">
              <a href="${verificationLink}" class="cta-button" target="_blank">
                ✅ Xác thực tài khoản ngay
              </a>
            </div>
            
            <div class="info-box">
              <div class="info-title">📋 Thông tin quan trọng:</div>
              <ul class="info-list">
                <li>✅ Link xác thực có hiệu lực trong <strong>24 giờ</strong></li>
                <li>🔐 Sau khi xác thực, bạn có thể đăng nhập an toàn</li>
                <li>🗑️ Tài khoản chưa xác thực sẽ bị xóa tự động</li>
                <li>🎯 Một lần xác thực, sử dụng trọn đời</li>
              </ul>
            </div>
            
            <div class="disclaimer">
              💡 <strong>Lưu ý:</strong> Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email. Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn.
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-text">© 2024 HealingMedicine. Bản quyền thuộc về chúng tôi.</div>
            <div class="footer-text">Email tự động - Vui lòng không trả lời trực tiếp.</div>
            <div class="footer-text">🌟 Cảm ơn bạn đã tin tương HealingMedicine!</div>
          </div>
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
