// const Promotion = require('../models/promotion.model')
// const Service = require('../models/service.model')

// const createPromotion = async(req,res) =>{
//     try {
//         const {title, description, discountType, discountValue, applyToAll, startDate, endDate} = req.body

//         if(title){
//             if(typeof title !== 'string' || title.trim().length === 0){
//                 return res.status(400).json({
//                     success : false,
//                     message : 'Tiêu đề giảm giá không được để trống'
//                 });
//             }

//             const cleanTitle = title.trim();

//             if(!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanTitle)){
//                 return res.status(400).json({
//                     success : falase,
//                     message : 'Tiêu đề không chứa kí tự đặc biệt'
//                 })
//             }
//         }


//     } catch (error) {
//         console.log('Lỗi khi tạo ưu đãi giảm giá cho dịch vụ', error);
//         return res.status(500).json({
//             success : false,
//             message : 'Đã xảy ra lỗi khi tạo ưu đãi giảm giá cho dịch vụ'
//         })
//     }
// }