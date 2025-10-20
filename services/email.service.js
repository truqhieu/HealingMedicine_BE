const { createTransporter, getVerificationEmailTemplate, getResetPasswordEmailTemplate } = require('../config/emailConfig');

class EmailService {

  createVerificationLink(token, email, baseUrl) {
    // Sử dụng FRONTEND_URL nếu có, fallback về baseUrl
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;
    return `${frontendUrl}/verify-email?token=${token}&email=${email}`;
  }

  createResetPasswordLink(token, email, baseUrl) {
    // Sử dụng FRONTEND_URL nếu có, fallback về baseUrl  
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;
    return `${frontendUrl}/reset-password?token=${token}&email=${email}`;
  }

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
