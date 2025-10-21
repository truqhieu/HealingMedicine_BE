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
      return this._sendViaSendGrid(
        email,
        'Xác thực tài khoản HealingMedicine',
        `Xin chào ${fullName}!\n\nVui lòng nhấp vào link để xác thực: ${verificationLink}`,
        `<a href="${verificationLink}">Xác thực tài khoản</a>`
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
    if (this.useSendGrid) {
      return this._sendViaSendGrid(
        email,
        'Đặt lại mật khẩu HealingMedicine',
        `Xin chào ${fullName}!\n\nVui lòng nhấp vào link để đặt lại mật khẩu: ${resetLink}`,
        `<a href="${resetLink}">Đặt lại mật khẩu</a>`
      );
    }

    const transporter = createTransporter();
    const emailTemplate = getResetPasswordEmailTemplate(fullName, resetLink);
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
    const { getAppointmentApprovedEmailTemplate } = require('../config/emailConfig');
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
    const { getAppointmentCancelledEmailTemplate } = require('../config/emailConfig');
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
}

module.exports = new EmailService();
