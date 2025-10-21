/**
 * Date Helper - Xử lý timezone Việt Nam (UTC+7)
 */

class DateHelper {
  
  /**
   * Convert từ UTC sang giờ Việt Nam
   * @param {Date} utcDate - Date object UTC
   * @returns {Date} - Date object theo giờ VN (UTC+7)
   */
  static utcToVietnamTime(utcDate) {
    const date = new Date(utcDate);
    // Thêm 7 giờ (UTC+7)
    date.setHours(date.getHours() + 7);
    return date;
  }

  /**
   * Convert từ giờ Việt Nam sang UTC
   * @param {Date} vnDate - Date object theo giờ VN
   * @returns {Date} - Date object UTC
   */
  static vietnamTimeToUTC(vnDate) {
    const date = new Date(vnDate);
    // Trừ 7 giờ
    date.setHours(date.getHours() - 7);
    return date;
  }

  /**
   * Format date theo định dạng Việt Nam
   * @param {Date} date 
   * @returns {string} - "Thứ Hai, 21 tháng 10, 2025"
   */
  static formatVietnameseDate(date) {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh'
    };
    return new Date(date).toLocaleDateString('vi-VN', options);
  }

  /**
   * Format time theo định dạng 24h Việt Nam
   * @param {Date} date 
   * @returns {string} - "08:00"
   */
  static formatVietnameseTime(date) {
    const options = { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false
    };
    return new Date(date).toLocaleTimeString('vi-VN', options);
  }

  /**
   * Format datetime đầy đủ
   * @param {Date} date 
   * @returns {string} - "21/10/2025 08:00"
   */
  static formatVietnameseDateTime(date) {
    const dateStr = new Date(date).toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    const timeStr = this.formatVietnameseTime(date);
    return `${dateStr} ${timeStr}`;
  }

  /**
   * Tạo Date object từ string với timezone VN
   * @param {string} dateString - ISO string hoặc date string
   * @returns {Date}
   */
  static parseVietnameseDate(dateString) {
    // Parse date và assume nó là giờ VN
    const date = new Date(dateString);
    // Nếu không có timezone info, xem như là giờ VN
    if (!dateString.includes('Z') && !dateString.includes('+')) {
      return this.vietnamTimeToUTC(date);
    }
    return date;
  }

  /**
   * Tạo Date object từ date và time string (giờ VN)
   * @param {string} dateStr - "2025-10-21"
   * @param {string} timeStr - "08:00"
   * @returns {Date} - UTC Date
   */
  static createVietnamDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    
    // Tạo date theo giờ VN (local time)
    const vnDate = new Date(year, month - 1, day, hour, minute, 0);
    
    // Convert sang UTC (trừ 7 giờ)
    return this.vietnamTimeToUTC(vnDate);
  }
}

module.exports = DateHelper;

