const Payment = require('../models/payment.model');
const Appointment = require('../models/appointment.model');
const sepayService = require('./sepay.service');
const emailService = require('./email.service');
const User = require('../models/user.model');

class PaymentService {

  /**
   * Tạo payment và QR code cho appointment
   */
  async createPayment(paymentData) {
    const { appointmentId, patientUserId, amount, holdExpiresAt, customerName } = paymentData;

    try {
      // Tạo QR code qua Sepay
      // Nếu có customerName → hiển thị tên khách hàng trên QR
      const qrData = await sepayService.generateQRCode({
        appointmentId,
        amount,
        customerName: customerName || 'Khach hang' // Tên sẽ hiển thị trên QR
      });

      // Tạo payment record
      const payment = await Payment.create({
        appointmentId,
        patientUserId,
        amount,
        method: 'Sepay',
        status: 'Pending',
        QRurl: qrData.qrUrl,
        holdExpiresAt
      });

      console.log('✅ Payment created:', payment._id);
      console.log('📱 QR Code URL:', qrData.qrUrl);

      return {
        payment,
        qrData
      };

    } catch (error) {
      console.error('❌ Lỗi tạo payment:', error);
      throw error;
    }
  }

  /**
   * Confirm payment sau khi nhận được thông báo từ Sepay
   */
  async confirmPayment(paymentId, transactionData) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        throw new Error('Payment không tồn tại');
      }

      if (payment.status === 'Completed') {
        console.log('⚠️  Payment đã được xác nhận trước đó');
        return { payment, alreadyConfirmed: true };
      }

      // Update payment status
      payment.status = 'Completed';
      await payment.save();

      // Update appointment status
      const appointment = await Appointment.findById(payment.appointmentId)
        .populate('patientUserId', 'fullName email')
        .populate('doctorUserId', 'fullName email')
        .populate('serviceId', 'serviceName')
        .populate('timeslotId', 'startTime endTime')
        .populate('customerId', 'fullName email');

      if (appointment) {
        appointment.status = 'Pending'; // Từ PendingPayment → Pending
        await appointment.save();

        // ⭐ UPDATE TIMESLOT: Reserved → Booked (khi thanh toán xong)
        const Timeslot = require('../models/timeslot.model');
        await Timeslot.findByIdAndUpdate(appointment.timeslotId._id, {
          status: 'Booked'
        });

        console.log('✅ Appointment confirmed:', appointment._id);
        console.log('✅ Timeslot updated: Reserved → Booked');

        // Gửi email xác nhận
        await this.sendPaymentConfirmationEmail(appointment);
      }

      return { payment, appointment };

    } catch (error) {
      console.error('❌ Lỗi confirm payment:', error);
      throw error;
    }
  }

  /**
   * Gửi email xác nhận sau khi thanh toán thành công
   */
  async sendPaymentConfirmationEmail(appointment) {
    try {
      // Xác định người nhận email
      let emailRecipient, recipientName;
      
      if (appointment.customerId) {
        emailRecipient = appointment.customerId.email;
        recipientName = appointment.customerId.fullName;
      } else {
        emailRecipient = appointment.patientUserId.email;
        recipientName = appointment.patientUserId.fullName;
      }

      const emailData = {
        fullName: recipientName,
        serviceName: appointment.serviceId.serviceName,
        doctorName: appointment.doctorUserId.fullName,
        startTime: appointment.timeslotId.startTime,
        endTime: appointment.timeslotId.endTime,
        type: appointment.type,
        mode: appointment.mode
      };

      await emailService.sendAppointmentConfirmationEmail(
        emailRecipient,
        emailData
      );

      console.log(`📧 Đã gửi email xác nhận thanh toán đến: ${emailRecipient}`);

    } catch (error) {
      console.error('❌ Lỗi gửi email:', error);
      // Không throw error vì payment đã success
    }
  }

  /**
   * Hủy payment khi hết thời gian giữ slot
   */
  async cancelExpiredPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        throw new Error('Payment không tồn tại');
      }

      if (payment.status !== 'Pending') {
        console.log('⚠️  Payment không ở trạng thái Pending');
        return null;
      }

      // Update payment status
      payment.status = 'Cancelled';
      await payment.save();

      // Update appointment status
      const appointment = await Appointment.findById(payment.appointmentId);
      if (appointment) {
        appointment.status = 'Expired';
        appointment.cancelReason = 'Không thanh toán trong thời gian quy định';
        await appointment.save();

        console.log('⏰ Payment và Appointment đã bị hủy do hết hạn');
      }

      return { payment, appointment };

    } catch (error) {
      console.error('❌ Lỗi cancel payment:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra và auto-confirm payment từ Sepay
   */
  async checkAndConfirmPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate('appointmentId');

      if (!payment || payment.status !== 'Pending') {
        return null;
      }

      // Lấy content để check
      const content = sepayService.generateTransferContent(payment.appointmentId._id);

      // Kiểm tra trạng thái giao dịch từ Sepay
      const transaction = await sepayService.checkTransactionStatus(content);

      if (transaction && transaction.found) {
        // Nếu tìm thấy giao dịch, confirm payment
        return await this.confirmPayment(paymentId, transaction);
      }

      return null;

    } catch (error) {
      console.error('❌ Lỗi check và confirm payment:', error);
      return null;
    }
  }

  /**
   * Lấy thông tin payment
   */
  async getPaymentInfo(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate('appointmentId')
        .populate('patientUserId', 'fullName email');

      if (!payment) {
        throw new Error('Payment không tồn tại');
      }

      return payment;

    } catch (error) {
      console.error('❌ Lỗi lấy payment info:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();

