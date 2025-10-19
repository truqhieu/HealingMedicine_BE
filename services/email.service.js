const { createTransporter, getVerificationEmailTemplate, getResetPasswordEmailTemplate } = require('../config/emailConfig');

class EmailService {

  /**
   * Tạo verification link
   */
  createVerificationLink(token, email, baseUrl) {
    return `${baseUrl}/api/auth/verify-email?token=${token}&email=${email}`;
  }

  /**
   * Tạo reset password link
   */
  createResetPasswordLink(token, email, baseUrl) {
    return `${baseUrl}/api/auth/reset-password?token=${token}&email=${email}`;
  }

  /**
   * Gửi email xác thực
   */
  async sendVerificationEmail(fullName, email, verificationLink) {
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

  /**
   * Gửi lại email xác thực với prefix
   */
  async resendVerificationEmail(fullName, email, verificationLink) {
    const transporter = createTransporter();
    const emailTemplate = getVerificationEmailTemplate(fullName, verificationLink);

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@healingmedicine.com',
      to: email,
      subject: '🔄 ' + emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }

  /**
   * Gửi email reset password
   */
  async sendResetPasswordEmail(fullName, email, resetLink) {
    const transporter = createTransporter();
    const emailTemplate = getResetPasswordEmailTemplate(fullName, resetLink);

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@healingmedicine.com',
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html
    });
  }
}

module.exports = new EmailService();
