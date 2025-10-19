/**
 * Utility functions cho ứng dụng
 */

/**
 * Validate confirmPassword một cách chặt chẽ
 * @param {string} password - Mật khẩu gốc
 * @param {string} confirmPassword - Mật khẩu xác nhận
 * @returns {object} - { isValid: boolean, message: string }
 */
function validateConfirmPassword(password, confirmPassword) {
  // Kiểm tra type
  if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
    return {
      isValid: false,
      message: 'Mật khẩu phải là chuỗi ký tự'
    };
  }

  // Kiểm tra độ dài
  if (password.length === 0 || confirmPassword.length === 0) {
    return {
      isValid: false,
      message: 'Mật khẩu không được để trống'
    };
  }

  // Kiểm tra độ dài khác nhau
  if (password.length !== confirmPassword.length) {
    return {
      isValid: false,
      message: 'Độ dài mật khẩu và xác nhận mật khẩu không khớp'
    };
  }

  // Kiểm tra nội dung chính xác (timing-safe comparison)
  if (!timingSafeEqual(password, confirmPassword)) {
    return {
      isValid: false,
      message: 'Mật khẩu và xác nhận mật khẩu không khớp'
    };
  }

  return {
    isValid: true,
    message: 'Mật khẩu hợp lệ'
  };
}

/**
 * Timing-safe string comparison để tránh timing attacks
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Sanitize password để loại bỏ thông tin nhạy cảm khỏi memory
 * Lưu ý: JavaScript strings are immutable, function này chỉ tạo reference mới
 * @param {string} str - String cần sanitize
 */
function sanitizePassword(obj) {
  // Trong JS, không thể thay đổi string trực tiếp
  // Chỉ có thể đảm bảo không giữ reference đến sensitive data
  if (typeof obj === 'object' && obj !== null && 'confirmPassword' in obj) {
    delete obj.confirmPassword;
  }
  return null; // Return null để clear reference
}

/**
 * Alternative: Validate password confirmation using header hash
 * FE gửi password hash trong header X-Confirm-Password-Hash
 * @param {string} password - Password từ body
 * @param {string} confirmHash - Hash từ header
 * @returns {object} - { isValid: boolean, message: string }
 */
function validatePasswordWithHeader(password, confirmHash) {
  const crypto = require('crypto');
  
  if (!password || !confirmHash) {
    return {
      isValid: false,
      message: 'Thiếu thông tin xác nhận mật khẩu'
    };
  }

  // Tạo hash từ password hiện tại
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  
  // So sánh với hash từ header (timing-safe)
  if (!timingSafeEqual(passwordHash, confirmHash)) {
    return {
      isValid: false,
      message: 'Mật khẩu không khớp'
    };
  }

  return {
    isValid: true,
    message: 'Mật khẩu hợp lệ'
  };
}

module.exports = {
  validateConfirmPassword,
  timingSafeEqual,
  sanitizePassword,
  validatePasswordWithHeader
};
