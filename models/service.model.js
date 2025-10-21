const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: [true, 'Vui lòng nhập tên dịch vụ.'],
    trim: true,
    unique : true
  },
  description : {
    type: String,
    required: [true, 'Vui lòng nhập mô tả dịch vụ.'],
    trim : true
  },
  price: {
    type: Number,
    required: [true, 'Vui lòng nhập giá dịch vụ.'],
  },
  isPrepaid: {
    type : Boolean,
    default : false
  },
  durationMinutes :{
    type : Number,
    required: [true, 'Vui lòng nhập thời gian xử lý dịch vụ.'],
  },
  status : {
    type : String,
    enum : ["Active","Inactive"],
    default : "Active"
  },
  category : {
    type : String,
    enum : ["Examination", "Consultation"],
    required: [true, 'Vui lòng nhập thể loại.'],
    default : "Examination"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);