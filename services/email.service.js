const { createTransporter, getVerificationEmailTemplate, getResetPasswordEmailTemplate, getAppointmentConfirmationEmailTemplate, getAppointmentApprovedEmailTemplate, getAppointmentCancelledEmailTemplate } = require('../config/emailConfig');

// Import SendGrid
const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    // Initialize SendGrid nếu có API key
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('✅ SendGrid initialized');
      this.useSendGrid = true;
    } else {
      console.warn('⚠️ SENDGRID_API_KEY not set, falling back to nodemailer');
      this.useSendGrid = false;
    }
  }

  createVerificationLink(token, email, baseUrl) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/verify-email?token=${token}&email=${email}`;
  }

  createResetPasswordLink(token, email, baseUrl) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/reset-password?token=${token}&email=${email}`;
  }

  async sendVerificationEmail(fullName, email, verificationLink) {
    if (this.useSendGrid) {
      const emailTemplate = getVerificationEmailTemplate(fullName, verificationLink);
      return this._sendViaSendGrid(
        email,
        emailTemplate.subject,
        emailTemplate.text,
        emailTemplate.html
      );
    }
    
    const transporter = createTransporter();
    const emailTemplate = getVerificationEmailTemplate(fullName, verificationLink);
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@healingmedicine.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  async resendVerificationEmail(fullName, email, verificationLink) {
    return this.sendVerificationEmail(fullName, email, verificationLink);
  }

  async sendResetPasswordEmail(fullName, email, resetLink) {
    // Luôn gọi template để lấy subject, text, html
    const emailTemplate = getResetPasswordEmailTemplate(fullName, resetLink);
    
    if (this.useSendGrid) {
      return this._sendViaSendGrid(
        email,
        emailTemplate.subject,
        emailTemplate.text,
        emailTemplate.html
      );
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@haianteeth.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  async sendAppointmentConfirmationEmail(email, appointmentData) {
    if (this.useSendGrid) {
      const emailTemplate = getAppointmentConfirmationEmailTemplate(appointmentData);
      return this._sendViaSendGrid(
        email,
        emailTemplate.subject,
        emailTemplate.text,
        emailTemplate.html
      );
    }

    const transporter = createTransporter();
    const emailTemplate = getAppointmentConfirmationEmailTemplate(appointmentData);
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@haianteeth.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  async sendAppointmentApprovedEmail(email, appointmentData) {
    if (this.useSendGrid) {
      const emailTemplate = getAppointmentApprovedEmailTemplate(appointmentData);
      return this._sendViaSendGrid(
        email,
        emailTemplate.subject,
        emailTemplate.text,
        emailTemplate.html
      );
    }

    const transporter = createTransporter();
    const emailTemplate = getAppointmentApprovedEmailTemplate(appointmentData);
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@haianteeth.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  async sendAppointmentCancelledEmail(email, appointmentData) {
    if (this.useSendGrid) {
      const emailTemplate = getAppointmentCancelledEmailTemplate(appointmentData);
      return this._sendViaSendGrid(
        email,
        emailTemplate.subject,
        emailTemplate.text,
        emailTemplate.html
      );
    }

    const transporter = createTransporter();
    const emailTemplate = getAppointmentCancelledEmailTemplate(appointmentData);
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@haianteeth.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  /**
   * ⭐ Helper: Send via SendGrid (HTTP API - không SMTP)
   */
  async _sendViaSendGrid(email, subject, text, html) {
    try {
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@haianteeth.com',
        subject: subject,
        text: text,
        html: html
      };

      await sgMail.send(msg);
      console.log(`✅ Email gửi qua SendGrid thành công đến: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Lỗi SendGrid:', error.message);
      throw error;
    }
  }

  // Generic method để gửi email với template
  async sendEmail(emailData) {
    const { to, subject, template, data } = emailData;
    
    if (!to || !subject) {
      throw new Error('Email và subject là bắt buộc');
    }

    let html, text;
    
    // Tạo nội dung email dựa trên template
    if (template === 'requestApproved') {
      html = this._getRequestApprovedTemplate(data);
      text = this._getRequestApprovedTextTemplate(data);
    } else if (template === 'requestRejected') {
      html = this._getRequestRejectedTemplate(data);
      text = this._getRequestRejectedTextTemplate(data);
    } else {
      // Fallback cho các template khác
      html = `<p>${data.message || 'Thông báo từ hệ thống'}</p>`;
      text = data.message || 'Thông báo từ hệ thống';
    }

    if (this.useSendGrid) {
      return this._sendViaSendGrid(to, subject, text, html);
    } else {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@haianteeth.com',
          to: to,
          subject: subject,
          text: text,
          html: html
        });
        console.log(`✅ Email gửi qua Nodemailer thành công đến: ${to}`);
        return true;
      } catch (error) {
        console.error('❌ Lỗi gửi email qua Nodemailer:', error.message);
        // Fallback: chỉ log ra console nếu không gửi được email
        console.log('📧 EMAIL CONTENT (Fallback):');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Text:', text);
        console.log('HTML:', html);
        return false;
      }
    }
  }

  _getRequestApprovedTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Yêu cầu đã được duyệt</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
          .container { max-width: 620px; margin: 24px auto; padding: 0 12px; }
          .card { overflow: hidden; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(90deg, #22c55e, #16a34a); color: white; padding: 24px; text-align: center; }
          .content { padding: 24px; }
          .success-icon { font-size: 48px; margin-bottom: 8px; }
          .title { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }
          .greeting { margin: 0 0 4px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; }
          .info-card h3 { margin: 0 0 8px; font-size: 16px; color: #111827; }
          .info-card ul { padding-left: 18px; margin: 0; }
          .info-card li { margin: 6px 0; }
          .footer { color: #6b7280; margin-top: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1 class="title">Yêu cầu đã được duyệt</h1>
            </div>
            <div class="content">
            <p>Xin chào <strong>${data.patientName}</strong>,</p>
            <p>Yêu cầu <strong>${data.requestType}</strong> của bạn đã được duyệt thành công!</p>
            
              <div class="info-card">
                <h3>Thông tin chi tiết</h3>
                <ul>
                  <li><strong>Loại yêu cầu:</strong> ${data.requestType}</li>
                  <li><strong>Thời gian duyệt:</strong> ${data.approvedAt}</li>
                  <li><strong>Người duyệt:</strong> ${data.staffName}</li>
                  ${data.appointmentDateVN ? `<li><strong>Ngày khám mới:</strong> ${data.appointmentDateVN}</li>` : ''}
                  ${data.appointmentStartVN ? `<li><strong>Giờ khám:</strong> ${data.appointmentStartVN} - ${data.appointmentEndVN}</li>` : ''}
                </ul>
              </div>
            
              <p class="footer">Lịch hẹn của bạn đã được cập nhật theo yêu cầu. Vui lòng kiểm tra lại thông tin trong tài khoản của bạn.</p>
              <p class="footer">Trân trọng,<br><strong>Đội ngũ Hải Anh Teeth</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  _getRequestApprovedTextTemplate(data) {
    return `
Yêu cầu đã được duyệt

Xin chào ${data.patientName},

Yêu cầu ${data.requestType} của bạn đã được duyệt thành công!

Thông tin chi tiết:
- Loại yêu cầu: ${data.requestType}
- Thời gian duyệt: ${data.approvedAt}
- Người duyệt: ${data.staffName}
${data.appointmentDateVN ? `- Ngày khám mới: ${data.appointmentDateVN}` : ''}
${data.appointmentStartVN ? `- Giờ khám: ${data.appointmentStartVN} - ${data.appointmentEndVN}` : ''}

Lịch hẹn của bạn đã được cập nhật theo yêu cầu. Vui lòng kiểm tra lại thông tin trong tài khoản của bạn.

Trân trọng,
Đội ngũ Hải Anh Teeth
    `;
  }

  _getRequestRejectedTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Yêu cầu bị từ chối</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
          .container { max-width: 620px; margin: 24px auto; padding: 0 12px; }
          .card { overflow: hidden; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(90deg, #ef4444, #dc2626); color: white; padding: 24px; text-align: center; }
          .content { padding: 24px; }
          .error-icon { font-size: 48px; margin-bottom: 8px; }
          .title { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; }
          .info-card h3 { margin: 0 0 8px; font-size: 16px; color: #111827; }
          .info-card ul { padding-left: 18px; margin: 0; }
          .info-card li { margin: 6px 0; }
          .reason-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px; }
          .footer { color: #6b7280; margin-top: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="error-icon">❌</div>
              <h1 class="title">Yêu cầu bị từ chối</h1>
            </div>
            <div class="content">
            <p>Xin chào <strong>${data.patientName}</strong>,</p>
            <p>Rất tiếc, yêu cầu <strong>${data.requestType}</strong> của bạn đã bị từ chối.</p>
            
              <div class="info-card">
                <h3>Thông tin chi tiết</h3>
                <ul>
                  <li><strong>Loại yêu cầu:</strong> ${data.requestType}</li>
                  <li><strong>Thời gian từ chối:</strong> ${data.rejectedAt}</li>
                  <li><strong>Người xử lý:</strong> ${data.staffName}</li>
                  ${data.requestedDateVN ? `<li><strong>Thời gian yêu cầu:</strong> ${data.requestedDateVN} ${data.requestedStartVN ? `- ${data.requestedStartVN} đến ${data.requestedEndVN}` : ''}</li>` : ''}
                </ul>
              </div>
            
              <div class="reason-box">
                <h3>Lý do từ chối</h3>
                <p style="margin: 6px 0 0;">${data.reason}</p>
              </div>
              
              <p class="footer">Vui lòng liên hệ với chúng tôi nếu bạn có thắc mắc hoặc muốn đặt lịch mới.</p>
              <p class="footer">Trân trọng,<br><strong>Đội ngũ Hải Anh Teeth</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  _getRequestRejectedTextTemplate(data) {
    return `
Yêu cầu bị từ chối

Xin chào ${data.patientName},

Rất tiếc, yêu cầu ${data.requestType} của bạn đã bị từ chối.

Thông tin chi tiết:
- Loại yêu cầu: ${data.requestType}
- Thời gian từ chối: ${data.rejectedAt}
- Người xử lý: ${data.staffName}
${data.requestedDateVN ? `- Thời gian yêu cầu: ${data.requestedDateVN}${data.requestedStartVN ? ` - ${data.requestedStartVN} đến ${data.requestedEndVN}` : ''}` : ''}

Lý do từ chối:
${data.reason}

Vui lòng liên hệ với chúng tôi nếu bạn có thắc mắc hoặc muốn đặt lịch mới.

Trân trọng,
Đội ngũ Hải Anh Teeth
    `;
  }
}

module.exports = new EmailService();
