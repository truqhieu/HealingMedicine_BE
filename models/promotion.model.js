const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    title : {
        type : String,
        required: [true, 'Vui lòng điền tiêu đề ưu đãi dịch vụ'],
        trim : true,
    },
    description :{
        type : String,
        required: [true, 'Vui điền mô tả của ưu đãi dịch vụ'],
        trim : true,
    },
    discountType : {
        type : String,
        enum : ["Percent","Fix"],
        trim : true,
    },
    discountValue : {
        type : Number,
        required: [true, 'Vui điền số tiền giảm của ưu đãi đối với dịch vụ'],
        trim : true,
    },
    applyToAll : {
        type : Boolean,
        default : true,
    },
    startDate : {
        type : Date,
        required : [true, 'Vui lòng nhập ngày bắt đầu ưu đãi giảm giá'],
        trim : true,
    },
    endDate : {
        type : Date,
        required : [true, 'Vui lòng nhập ngày kết thúc ưu đãi giảm giá'],
        trim : true,
    },
    status : {
        type : String,
        enum : ["Active","Expired"],
        default : "Active",
    }
},{
  timestamps: true
});

module.exports = mongoose.model('Promotion', promotionSchema,'promotions');