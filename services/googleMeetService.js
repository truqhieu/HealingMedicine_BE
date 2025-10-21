/**
 * Google Meet Service
 * Tạo liên kết Google Meet cho các cuộc hẹn tư vấn online
 * 
 * Hướng dẫn setup:
 * 1. Truy cập: https://console.cloud.google.com
 * 2. Tạo project mới hoặc sử dụng project hiện tại
 * 3. Bật Google Calendar API
 * 4. Tạo Service Account credentials (JSON key)
 * 5. Chia sẻ Google Calendar đó cho service account email
 * 6. Lưu file JSON vào config/google-credentials.json
 * 7. Thêm GOOGLE_CALENDAR_ID vào .env
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleMeetService {
  constructor() {
    this.initialized = false;
    this.calendar = null;
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.init();
  }

  /**
   * Khởi tạo Google Calendar API
   */
  init() {
    try {
      // Đường dẫn đến file credentials
      const credentialsPath = path.join(__dirname, '../config/google-credentials.json');
      
      // Kiểm tra xem file credentials có tồn tại không
      if (!fs.existsSync(credentialsPath)) {
        console.warn('⚠️ File google-credentials.json không tồn tại.');
        console.warn('📝 Hướng dẫn setup Google Calendar API:');
        console.warn('   1. Truy cập https://console.cloud.google.com');
        console.warn('   2. Tạo Service Account và download JSON key');
        console.warn('   3. Lưu vào: config/google-credentials.json');
        console.warn('   4. Thêm GOOGLE_CALENDAR_ID vào .env');
        return;
      }

      const credentials = require('../config/google-credentials.json');
      
      // Tạo JWT client
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ]
      });

      this.calendar = google.calendar({ version: 'v3', auth });
      this.initialized = true;
      console.log('✅ Google Calendar API initialized');
    } catch (error) {
      console.error('⚠️ Lỗi khởi tạo Google Calendar API:', error.message);
    }
  }

  async generateMeetLink(meetData) {
    try {
      if (!this.initialized) {
        console.warn('⚠️ Google Calendar API chưa được khởi tạo');
        
        // Trả về link tĩnh nếu không có credentials
        // Có thể dùng zoom hoặc tạo link custom của riêng bạn
        const staticMeetLink = `${process.env.APP_URL}/appointment/${meetData.appointmentId}/meet`;
        console.log('📌 Sử dụng link tĩnh thay thế:', staticMeetLink);
        return staticMeetLink;
      }

      const { appointmentId, doctorName, patientName, startTime, endTime, serviceName } = meetData;

      // Tạo event trong Google Calendar
      const event = {
        summary: `Tư vấn - ${serviceName}`,
        description: `
Bác sĩ: ${doctorName}
Bệnh nhân: ${patientName}
Dịch vụ: ${serviceName}
Appointment ID: ${appointmentId}

Đây là cuộc tư vấn online thông qua Google Meet.
        `.trim(),
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh'
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh'
        },
        conferenceData: {
          createRequest: {
            requestId: `appointment-${appointmentId}`,
            conferenceSolutionKey: {
              key: 'hangoutsMeet'
            }
          }
        },
        attendees: [
          {
            email: process.env.GOOGLE_CALENDAR_EMAIL || 'noreply@haianteeth.com',
            organizer: true,
            responseStatus: 'accepted'
          }
        ],
        transparency: 'opaque'
      };

      // Tạo event với Google Meet
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event,
        conferenceDataVersion: 1
      });

      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;
      
      if (meetLink) {
        console.log('✅ Tạo Google Meet link thành công');
        console.log('   - Event ID:', response.data.id);
        console.log('   - Meet Link:', meetLink);
        return meetLink;
      } else {
        console.warn('⚠️ Google Meet link không được tạo, sử dụng link tĩnh');
        const staticMeetLink = `${process.env.APP_URL}/appointment/${appointmentId}/meet`;
        return staticMeetLink;
      }

    } catch (error) {
      console.error('❌ Lỗi tạo Google Meet link:', error.message);
      
      // Fallback: trả về link tĩnh
      const staticMeetLink = `${process.env.APP_URL}/appointment/${meetData.appointmentId}/meet`;
      console.log('📌 Sử dụng link tĩnh thay thế:', staticMeetLink);
      return staticMeetLink;
    }
  }

  /**
   * Xóa event Google Meet nếu cần (khi hủy appointment)
   */
  async deleteMeetLink(eventId) {
    try {
      if (!this.initialized || !eventId) {
        return true;
      }

      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId
      });

      console.log('✅ Đã xóa Google Meet event:', eventId);
      return true;
    } catch (error) {
      console.error('❌ Lỗi xóa Google Meet link:', error.message);
      return false;
    }
  }
}

module.exports = new GoogleMeetService();
