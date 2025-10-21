const nodemailer = require('nodemailer');
const DateHelper = require('../utils/dateHelper');

const createTransporter = () => {
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

const getResetPasswordEmailTemplate = (fullName, resetLink) => {
  return {
    subject: `Đặt lại mật khẩu HealingMedicine`,
    text: `
Xin chào ${fullName}!

Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản HealingMedicine.

Để đặt lại mật khẩu, vui lòng nhấp vào link sau:
${resetLink}

Link có hiệu lực trong 10 phút.

Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

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
    <div style="background: linear-gradient(135deg, rgb(38, 220, 84) 0%, rgb(38, 220, 84) 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        🔒 Đặt lại mật khẩu
      </h1>
      <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px; opacity: 0.9;">
        HealingMedicine
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">
        Xin chào ${fullName}! 👋
      </h2>
      
      <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Bạn đã yêu cầu <strong style="color:rgb(38, 220, 84);">đặt lại mật khẩu</strong> cho tài khoản HealingMedicine của bạn.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; background: linear-gradient(135deg, rgb(38, 220, 84) 0%, rgb(38, 220, 84) 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
          🔄 Đặt lại mật khẩu
        </a>
      </div>
      
      <!-- Info Box -->
      <div style="background: #fef2f2; border-left: 4px solidrgb(38, 220, 47); padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 18px; margin-right: 8px;">⏰</span>
          <strong style="color: #1e293b; font-size: 14px;">Quan trọng</strong>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
          Link đặt lại có hiệu lực trong <strong style="color:rgb(235, 12, 12);">10 phút</strong>. 
          Sau khi đặt lại thành công, bạn có thể đăng nhập với mật khẩu mới.
        </p>
      </div>
      
      <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
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

const getAppointmentConfirmationEmailTemplate = (appointmentData) => {
  const { fullName, serviceName, doctorName, startTime, endTime, type, mode } = appointmentData;
  
  // Format date and time với timezone Việt Nam (UTC+7) sử dụng DateHelper
  const formattedDate = DateHelper.formatVietnameseDate(startTime);
  const formattedStartTime = DateHelper.formatVietnameseTime(startTime);
  const formattedEndTime = DateHelper.formatVietnameseTime(endTime);

  const typeText = type === 'Consultation' ? 'Tư vấn' : type === 'Examination' ? 'Khám bệnh' : 'Tái khám';
  const modeText = mode === 'Online' ? 'Trực tuyến' : 'Trực tiếp';

  console.log('📧 Email template data:');
  console.log('   - Start Time UTC:', startTime);
  console.log('   - End Time UTC:', endTime);
  console.log('   - Formatted Date VN:', formattedDate);
  console.log('   - Formatted Start Time VN:', formattedStartTime);
  console.log('   - Formatted End Time VN:', formattedEndTime);

  return {
    subject: `Xác nhận đặt lịch ${typeText} - HaiAnhTeeth`,
    text: `
Xin chào ${fullName}!

Cảm ơn bạn đã đặt lịch ${typeText.toLowerCase()} tại HaiAnhTeeth.

THÔNG TIN CUỘC HẸN:
- Dịch vụ: ${serviceName}
- Bác sĩ: ${doctorName}
- Thời gian: ${formattedStartTime} - ${formattedEndTime}
- Ngày: ${formattedDate}
- Hình thức: ${modeText}

Cuộc hẹn của bạn đang chờ xác nhận từ phòng khám. Chúng tôi sẽ thông báo cho bạn sớm nhất.

Nếu cần thay đổi hoặc hủy lịch hẹn, vui lòng liên hệ hotline: 1900-xxxx

Trân trọng,
HaiAnhTeeth Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
        🦷 HaiAnhTeeth
      </h1>
      <p style="margin: 8px 0 0 0; color: #cffafe; font-size: 14px; opacity: 0.9;">
        Nha khoa uy tín - Nụ cười rạng rỡ
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: #dcfce7; border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 40px; margin-bottom: 15px;">
          ✅
        </div>
        <h2 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 600;">
          Đặt lịch thành công!
        </h2>
      </div>
      
      <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Xin chào <strong style="color: #0891b2;">${fullName}</strong>! 👋
      </p>
      
      <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Cảm ơn bạn đã đặt lịch ${typeText.toLowerCase()} tại <strong style="color: #0891b2;">HaiAnhTeeth</strong>. 
        Chúng tôi đã nhận được yêu cầu của bạn.
      </p>
      
      <!-- Appointment Details Box -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.15);">
        <h3 style="margin: 0 0 20px 0; color: #059669; font-size: 18px; font-weight: 600; text-align: center;">
          📋 Thông tin cuộc hẹn
        </h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top; width: 36px;">
              <span style="font-size: 20px;">💊</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top; width: 100px;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Dịch vụ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${serviceName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">👨‍⚕️</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Bác sĩ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${doctorName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">📅</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Ngày hẹn</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${formattedDate}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">🕐</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Thời gian</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500; padding: 4px 12px; border-radius: 6px;">${formattedStartTime} - ${formattedEndTime}</span>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">${mode === 'Online' ? '💻' : '🏥'}</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Hình thức</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${modeText}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Status Info Box -->
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 18px; margin-right: 8px;">⏳</span>
          <strong style="color: #1e293b; font-size: 14px;">Trạng thái</strong>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
          Cuộc hẹn của bạn đang <strong style="color: #f59e0b;">chờ xác nhận</strong> từ phòng khám. 
          Chúng tôi sẽ thông báo cho bạn qua email khi cuộc hẹn được xác nhận.
        </p>
      </div>
      
      <!-- Contact Info -->
      <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
          📞 Cần hỗ trợ?
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
          Nếu cần thay đổi hoặc hủy lịch hẹn, vui lòng liên hệ:<br>
          <strong>Hotline:</strong> 1900-xxxx<br>
          <strong>Email:</strong> support@haianteeth.com
        </p>
      </div>
      
      <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center;">
        Cảm ơn bạn đã tin tưởng HaiAnhTeeth!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">
        🦷 HaiAnhTeeth
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

const getAppointmentApprovedEmailTemplate = (appointmentData) => {
  const { fullName, serviceName, doctorName, startTime, endTime, type, mode, meetLink } = appointmentData;
  
  // Format date and time
  const formattedDate = DateHelper.formatVietnameseDate(startTime);
  const formattedStartTime = DateHelper.formatVietnameseTime(startTime);
  const formattedEndTime = DateHelper.formatVietnameseTime(endTime);

  const typeText = type === 'Consultation' ? 'Tư vấn' : type === 'Examination' ? 'Khám bệnh' : 'Tái khám';
  const modeText = mode === 'Online' ? 'Trực tuyến' : 'Trực tiếp';

  const isMeetLink = meetLink && (meetLink.includes('meet.google.com') || meetLink.includes('/meet'));

  return {
    subject: `✅ Lịch ${typeText} được xác nhận - HaiAnhTeeth`,
    text: `
Xin chào ${fullName}!

Chúng tôi thông báo với bạn rằng lịch ${typeText.toLowerCase()} đã được xác nhận!

THÔNG TIN CUỘC HẸN:
- Dịch vụ: ${serviceName}
- Bác sĩ: ${doctorName}
- Thời gian: ${formattedStartTime} - ${formattedEndTime}
- Ngày: ${formattedDate}
- Hình thức: ${modeText}

${isMeetLink ? `LIÊN KẾT CUỘC HỌP:
${meetLink}

Vui lòng nhấp vào link trên vào thời gian dự kiến để tham gia cuộc tư vấn.` : ''}

Nếu cần thay đổi hoặc có bất cứ câu hỏi nào, vui lòng liên hệ hotline: 1900-xxxx

Trân trọng,
HaiAnhTeeth Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
        ✅ Xác nhận lịch hẹn
      </h1>
      <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px; opacity: 0.9;">
        HaiAnhTeeth - Nha khoa uy tín
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Xin chào <strong style="color: #059669;">${fullName}</strong>! 👋
      </p>
      
      <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Chúng tôi vui mừng thông báo rằng lịch <strong style="color: #059669;">${typeText.toLowerCase()}</strong> của bạn đã được <strong style="color: #059669;">xác nhận</strong>! 
        Vui lòng ghi chú những thông tin bên dưới.
      </p>
      
      <!-- Appointment Details Box -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.15);">
        <h3 style="margin: 0 0 20px 0; color: #059669; font-size: 18px; font-weight: 600; text-align: center;">
          📋 Thông tin cuộc hẹn
        </h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top; width: 36px;">
              <span style="font-size: 20px;">💊</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top; width: 100px;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Dịch vụ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${serviceName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">👨‍⚕️</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Bác sĩ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${doctorName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">📅</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Ngày hẹn</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${formattedDate}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #d1fae5;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">🕐</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Thời gian</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${formattedStartTime} - ${formattedEndTime}</span>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">${mode === 'Online' ? '💻' : '🏥'}</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #065f46; font-size: 14px; font-weight: 400;">Hình thức</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #047857; font-size: 15px; font-weight: 500;">${modeText}</span>
            </td>
          </tr>
        </table>
      </div>

      ${isMeetLink ? `
      <!-- Google Meet Link -->
      <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0284c7; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.15);">
        <h3 style="margin: 0 0 20px 0; color: #0369a1; font-size: 18px; font-weight: 600; text-align: center;">
          💻 Liên kết cuộc họp
        </h3>
        
        <p style="margin: 0 0 20px 0; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
          Vui lòng nhấp vào link bên dưới vào thời gian dự kiến để tham gia cuộc tư vấn trực tuyến:
        </p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${meetLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
            🔗 Vào cuộc họp Google Meet
          </a>
        </div>

        <p style="margin: 0; color: #0c4a6e; font-size: 13px; line-height: 1.5; word-break: break-all;">
          <strong>Hoặc sao chép link:</strong><br>
          <code style="background: white; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 8px; font-size: 12px; color: #0369a1;">${meetLink}</code>
        </p>
      </div>
      ` : ''}
      
      <!-- Info Box -->
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 18px; margin-right: 8px;">💡</span>
          <strong style="color: #1e293b; font-size: 14px;">Gợi ý hữu ích</strong>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
          Vui lòng:
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #64748b; font-size: 14px;">
            <li>Đến sớm 5-10 phút trước giờ hẹn</li>
            <li>Kiểm tra kết nối Internet của bạn</li>
            <li>Chuẩn bị một nơi yên tĩnh để tư vấn</li>
          </ul>
        </p>
      </div>
      
      <!-- Contact Info -->
      <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
          📞 Cần hỗ trợ?
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
          Nếu có bất cứ câu hỏi nào, vui lòng liên hệ:<br>
          <strong>Hotline:</strong> 1900-xxxx<br>
          <strong>Email:</strong> support@haianteeth.com
        </p>
      </div>
      
      <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center;">
        Cảm ơn bạn đã tin tưởng HaiAnhTeeth!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">
        🦷 HaiAnhTeeth
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

const getAppointmentCancelledEmailTemplate = (appointmentData) => {
  const { fullName, serviceName, doctorName, startTime, endTime, type, mode, cancelReason } = appointmentData;
  
  // Format date and time
  const formattedDate = DateHelper.formatVietnameseDate(startTime);
  const formattedStartTime = DateHelper.formatVietnameseTime(startTime);
  const formattedEndTime = DateHelper.formatVietnameseTime(endTime);

  const typeText = type === 'Consultation' ? 'Tư vấn' : type === 'Examination' ? 'Khám bệnh' : 'Tái khám';
  const modeText = mode === 'Online' ? 'Trực tuyến' : 'Trực tiếp';

  return {
    subject: `❌ Lịch ${typeText} đã bị hủy - HaiAnhTeeth`,
    text: `
Xin chào ${fullName}!

Chúng tôi xin thông báo rằng lịch ${typeText.toLowerCase()} của bạn đã bị hủy.

THÔNG TIN CUỘC HẸN ĐÃ HỦY:
- Dịch vụ: ${serviceName}
- Bác sĩ: ${doctorName}
- Thời gian: ${formattedStartTime} - ${formattedEndTime}
- Ngày: ${formattedDate}
- Hình thức: ${modeText}

LÝ DO HỦY:
${cancelReason}

Nếu bạn muốn đặt lịch mới hoặc có bất cứ câu hỏi nào, vui lòng liên hệ hotline: 1900-xxxx

Trân trọng,
HaiAnhTeeth Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
        ❌ Lịch hẹn đã bị hủy
      </h1>
      <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px; opacity: 0.9;">
        HaiAnhTeeth - Nha khoa uy tín
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Xin chào <strong style="color: #dc2626;">${fullName}</strong>! 👋
      </p>
      
      <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
        Chúng tôi xin thông báo rằng lịch <strong style="color: #dc2626;">${typeText.toLowerCase()}</strong> của bạn đã bị <strong style="color: #dc2626;">hủy</strong>.
      </p>
      
      <!-- Appointment Details Box -->
      <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);">
        <h3 style="margin: 0 0 20px 0; color: #dc2626; font-size: 18px; font-weight: 600; text-align: center;">
          📋 Thông tin cuộc hẹn đã hủy
        </h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #fecaca;">
            <td style="padding: 12px 0; vertical-align: top; width: 36px;">
              <span style="font-size: 20px;">💊</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top; width: 100px;">
              <span style="color: #7f1d1d; font-size: 14px; font-weight: 400;">Dịch vụ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #991b1b; font-size: 15px; font-weight: 500;">${serviceName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #fecaca;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">👨‍⚕️</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #7f1d1d; font-size: 14px; font-weight: 400;">Bác sĩ</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #991b1b; font-size: 15px; font-weight: 500;">${doctorName}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #fecaca;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">📅</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #7f1d1d; font-size: 14px; font-weight: 400;">Ngày hẹn</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #991b1b; font-size: 15px; font-weight: 500;">${formattedDate}</span>
            </td>
          </tr>
          
          <tr style="border-bottom: 1px solid #fecaca;">
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">🕐</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #7f1d1d; font-size: 14px; font-weight: 400;">Thời gian</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #991b1b; font-size: 15px; font-weight: 500;">${formattedStartTime} - ${formattedEndTime}</span>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="font-size: 20px;">${mode === 'Online' ? '💻' : '🏥'}</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #7f1d1d; font-size: 14px; font-weight: 400;">Hình thức</span>
            </td>
            <td style="padding: 12px 0; vertical-align: top;">
              <span style="color: #991b1b; font-size: 15px; font-weight: 500;">${modeText}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Cancel Reason Box -->
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 18px; margin-right: 8px;">📌</span>
          <strong style="color: #1e293b; font-size: 14px;">Lý do hủy lịch</strong>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
          ${cancelReason}
        </p>
      </div>
      
      <!-- Rebook Info -->
      <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
          📞 Muốn đặt lịch khác?
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
          Bạn có thể đặt lịch mới bất cứ lúc nào hoặc liên hệ chúng tôi để được hỗ trợ:<br>
          <strong>Hotline:</strong> 1900-xxxx<br>
          <strong>Email:</strong> support@haianteeth.com
        </p>
      </div>
      
      <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center;">
        Cảm ơn bạn đã tin tưởng HaiAnhTeeth!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">
        🦷 HaiAnhTeeth
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
  getVerificationEmailTemplate,
  getResetPasswordEmailTemplate,
  getAppointmentConfirmationEmailTemplate,
  getAppointmentApprovedEmailTemplate,
  getAppointmentCancelledEmailTemplate
};
