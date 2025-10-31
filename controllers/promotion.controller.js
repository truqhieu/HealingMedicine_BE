const Promotion = require('../models/promotion.model')
const PromotionService = require('../models/promotionService.model')
const Service = require('../models/service.model')

const createPromotion = async (req, res) => {
    try {
        const {
            title,
            description,
            discountType,
            discountValue,
            applyToAll,
            startDate,
            endDate,
            serviceIds
        } = req.body;

        // ===== 1. VALIDATE TITLE =====
        if (typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Tiêu đề giảm giá không được để trống' });
        }
        const cleanTitle = title.trim();
        if (!/^[\p{L}0-9\s\-%()]+$/u.test(cleanTitle)) {
            return res.status(400).json({ success: false, message: 'Tiêu đề chỉ được chứa chữ, số, khoảng trắng và ký tự: % - ( )' });
        }
        if (cleanTitle.length < 5 || cleanTitle.length > 100) {
            return res.status(400).json({ success: false, message: 'Tiêu đề phải từ 5 đến 100 ký tự' });
        }

        // ===== 2. VALIDATE DESCRIPTION =====
        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Mô tả giảm giá không được để trống' });
        }
        const cleanDescription = description.trim();
        if (!/^[\p{L}0-9\s\.,!?\-%()]+$/u.test(cleanDescription)) {
            return res.status(400).json({ success: false, message: 'Mô tả chỉ được chứa chữ, số, khoảng trắng và ký tự: . , ! ? - % ( )' });
        }
        if (cleanDescription.length < 10) {
            return res.status(400).json({ success: false, message: 'Mô tả phải có ít nhất 10 ký tự' });
        }

        // ===== 3. VALIDATE DISCOUNT TYPE & VALUE =====
        if (typeof discountType !== 'string' || discountType.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Thể loại giảm giá không được để trống' });
        }
        const trimmedType = discountType.trim();
        if (!['Percent', 'Fix'].includes(trimmedType)) {
            return res.status(400).json({ success: false, message: 'Thể loại giảm giá chỉ được là "Percent" hoặc "Fix"' });
        }
        if (typeof discountValue !== 'number' || isNaN(discountValue)) {
            return res.status(400).json({ success: false, message: 'Giá trị giảm giá phải là số' });
        }
        if (trimmedType === 'Percent' && (discountValue < 1 || discountValue > 100)) {
            return res.status(400).json({ success: false, message: 'Giảm theo phần trăm phải từ 1 đến 100' });
        }
        if (trimmedType === 'Fix' && discountValue <= 0) {
            return res.status(400).json({ success: false, message: 'Giá trị giảm cố định phải lớn hơn 0' });
        }

        // ===== 4. VALIDATE APPLY TO ALL =====
        if (typeof applyToAll !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Áp dụng cho tất cả phải là true hoặc false' });
        }
        const isApplyToAll = applyToAll === true;

        let finalServiceIds = [];
        if (!isApplyToAll) {
            if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một dịch vụ khi không áp dụng cho tất cả' });
            }
            finalServiceIds = serviceIds;
        } else {
            // Lấy tất cả service nếu applyAll
            finalServiceIds = await Service.find().distinct('_id');
        }

        // ===== 5. VALIDATE DATES =====
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
        }
        if (end <= start) {
            return res.status(400).json({ success: false, message: 'Ngày kết thúc phải sau ngày bắt đầu' });
        }

        // ===== 6. CHECK CONFLICT PROMOTION FOR SERVICES =====
        const conflictingPromotions = await PromotionService.aggregate([
            { $match: { serviceId: { $in: finalServiceIds } } },
            { $lookup: { from: 'promotions', localField: 'promotionId', foreignField: '_id', as: 'promotion' } },
            { $unwind: '$promotion' },
            { $match: { 
                $or: [
                    { 'promotion.startDate': { $lte: end }, 'promotion.endDate': { $gte: start } }
                ]
            }}
        ]);

        if (conflictingPromotions.length > 0) {
            const conflictedServiceIds = conflictingPromotions.map(c => c.serviceId);
            return res.status(400).json({
                success: false,
                message: 'Một số dịch vụ đã có khuyến mãi trùng thời gian',
                conflictedServiceIds
            });
        }

        // ===== 7. TÍNH STATUS REALTIME =====
        const now = new Date();
        let status = 'Upcoming';
        if (start <= now && now <= end) status = 'Active';
        else if (now > end) status = 'Expired';

        // ===== 8. TẠO PROMOTION =====
        const promotion = new Promotion({
            title: cleanTitle,
            description: cleanDescription,
            discountType: trimmedType,
            discountValue,
            applyToAll: isApplyToAll,
            startDate: start,
            endDate: end,
            status
        });
        await promotion.save();

        // ===== 9. TẠO LIÊN KẾT DỊCH VỤ TRONG PromotionService =====
        if (finalServiceIds.length > 0) {
            const links = finalServiceIds.map(id => ({ promotionId: promotion._id, serviceId: id }));
            await PromotionService.insertMany(links);
        }

        // ===== 10. LẤY TÊN DỊCH VỤ =====
        const appliedServices = await Service.find({ _id: { $in: finalServiceIds } })
            .select('_id serviceName')
            .lean();

        // ===== 11. TRẢ KẾT QUẢ =====
        res.status(201).json({
            success: true,
            message: 'Tạo ưu đãi giảm giá thành công',
            data: {
                ...promotion.toObject(),
                appliedServices, // [{_id, name}, ...]
                status
            }
        });

    } catch (error) {
        console.error('Lỗi khi tạo ưu đãi giảm giá:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo ưu đãi giảm giá'
        });
    }
};



const getAllPromotions = async (req, res) => {
    try {
        const {
            search,           
            startDate,      
            endDate,         
            discountType,   
            status,  
            sort = 'desc',    
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;

        const filter = {}
        if(discountType) filter.discountType = discountType
        if(status) filter.status = status

        if(search && String(search).trim().length > 0){
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filter.$or = [
        {title : {$regex : regex}},
        {description : {$regex : regex}},
      ]   
    }     

        const now = new Date();
        await Promotion.updateMany(
          { endDate: { $lt: now }, status: { $ne: 'Expired' } },
          { $set: { status: 'Expired' } }
        );
        if (startDate || endDate) {
          filter.startDate = {};
          if (startDate) {
            const start = new Date(startDate);
            if (!isNaN(start)) filter.startDate.$gte = start;
          }
          if (endDate) {
            const end = new Date(endDate);
            if (!isNaN(end)) filter.startDate.$lte = end;
          }
        }
    
        // 🔽 Sắp xếp theo ngày mua (purchaseDate)
        const sortOrder = sort.toLowerCase() === 'asc' ? 1 : -1;

        const [total, promotions] = await Promise.all([
          Promotion.countDocuments(filter),
          Promotion.find(filter)
            .select('-__v')
            .sort({ startDate: sortOrder }) // ✅ Sắp xếp
            .skip(skip)
            .limit(limitNum)
            .lean()
        ]);
    
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        return res.status(200).json({
          success: true,
          total,
          totalPages,
          page: pageNum,
          limit: limitNum,
          data: promotions
        });    
    } catch (error) {
        console.error('Lỗi lấy danh sách ưu đãi', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi lấy danh sách ưu đãi'
        });
    }
};

const viewDetailPromotion = async(req,res) =>{
    try {
        const result = await Promotion.findById(req.params.id)
        if(!result){
            return res.status(400).json({
                success : false,
                message : 'Không tìm thấy ưu đãi'
            })
        }
        res.status(200).json({
            success : true,
            message : 'Chi tiết ưu đãi',
            data : result
        })
    } catch (error) {
        console.error('Lỗi khi xem chi tiết ưu đãi', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xem chi tiếi ưu đãi'
        });        
    }
}

const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            discountType,
            discountValue,
            applyToAll,
            startDate,
            endDate,
            serviceIds
        } = req.body;

        // === 1. TÌM PROMOTION ===
        const promotion = await Promotion.findById(id);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ưu đãi'
            });
        }

        // === 2. VALIDATE TITLE ===
        let cleanTitle = promotion.title;
        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tiêu đề không được để trống'
                });
            }
            cleanTitle = title.trim();
            if (!/^[\p{L}0-9\s\-%()]+$/u.test(cleanTitle)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tiêu đề chỉ được chứa chữ, số, khoảng trắng và ký tự: % - ( )'
                });
            }
            if (cleanTitle.length < 5 || cleanTitle.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Tiêu đề phải từ 5 đến 100 ký tự'
                });
            }
        }

        // === 3. VALIDATE DESCRIPTION ===
        let cleanDescription = promotion.description;
        if (description !== undefined) {
            if (typeof description !== 'string' || description.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mô tả không được để trống'
                });
            }
            cleanDescription = description.trim();
            if (!/^[\p{L}0-9\s\.,!?\-%()]+$/u.test(cleanDescription)) {
                return res.status(400).json({
                    success: false,
                    message: 'Mô tả chỉ được chứa chữ, số, khoảng trắng và ký tự: . , ! ? - % ( )'
                });
            }
            if (cleanDescription.length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Mô tả phải có ít nhất 10 ký tự'
                });
            }
        }

        // === 4. VALIDATE DISCOUNT TYPE & VALUE ===
        let finalDiscountType = promotion.discountType;
        let finalDiscountValue = promotion.discountValue;

        if (discountType !== undefined) {
            if (typeof discountType !== 'string' || discountType.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Thể loại giảm giá không được để trống'
                });
            }
            const trimmedType = discountType.trim();
            if (!['Percent', 'Fix'].includes(trimmedType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Thể loại giảm giá chỉ được là Percent hoặc Fix'
                });
            }
            finalDiscountType = trimmedType;
        }

        if (discountValue !== undefined) {
            if (typeof discountValue !== 'number' || isNaN(discountValue)) {
                return res.status(400).json({
                    success: false,
                    message: 'Giá trị giảm giá phải là số'
                });
            }
            if (finalDiscountType === 'Percent' && (discountValue < 1 || discountValue > 100)) {
                return res.status(400).json({
                    success: false,
                    message: 'Giảm theo phần trăm phải từ 1 đến 100'
                });
            }
            if (finalDiscountType === 'Fix' && discountValue <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Giá trị giảm cố định phải lớn hơn 0'
                });
            }
            finalDiscountValue = discountValue;
        }

        // === 5. VALIDATE APPLY TO ALL & SERVICE IDS ===
        let isApplyToAll = promotion.applyToAll;
        if (applyToAll !== undefined) {
            if (typeof applyToAll !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Áp dụng cho tất cả phải là true hoặc false'
                });
            }
            isApplyToAll = applyToAll;
        }

        if (!isApplyToAll && serviceIds !== undefined) {
            if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn ít nhất một dịch vụ khi không áp dụng cho tất cả'
                });
            }
        }

        // === 6. VALIDATE DATES (nếu có thay đổi) ===
        let finalStartDate = promotion.startDate;
        let finalEndDate = promotion.endDate;

        if (startDate !== undefined || endDate !== undefined) {
            const newStart = startDate ? new Date(startDate) : promotion.startDate;
            const newEnd = endDate ? new Date(endDate) : promotion.endDate;

            if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày không hợp lệ'
                });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Không cho phép sửa startDate về quá khứ
            if (newStart < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày bắt đầu không được sửa về trước hôm nay'
                });
            }

            if (newEnd <= newStart) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày kết thúc phải sau ngày bắt đầu'
                });
            }

            finalStartDate = newStart;
            finalEndDate = newEnd;
        }

        // === 7. TÍNH STATUS REALTIME ===
        const now = new Date();
        let newStatus = 'Upcoming';

        if (finalStartDate <= now && now <= finalEndDate) {
            newStatus = 'Active';
        }
        // Không bao giờ là Expired khi cập nhật (do validate ngày)

        // === 8. CẬP NHẬT PROMOTION ===
        promotion.title = cleanTitle;
        promotion.description = cleanDescription;
        promotion.discountType = finalDiscountType;
        promotion.discountValue = finalDiscountValue;
        promotion.applyToAll = isApplyToAll;
        promotion.startDate = finalStartDate;
        promotion.endDate = finalEndDate;
        promotion.status = newStatus; // Cập nhật status realtime

        await promotion.save();

        // === 9. CẬP NHẬT LIÊN KẾT DỊCH VỤ (nếu cần) ===
        if (!isApplyToAll && serviceIds !== undefined) {
            // Xóa cũ
            await PromotionService.deleteMany({ promotionId: promotion._id });
            // Thêm mới
            if (serviceIds.length > 0) {
                const links = serviceIds.map(id => ({
                    promotionId: promotion._id,
                    serviceId: id
                }));
                await PromotionService.insertMany(links);
            }
        }

        // === 10. TRẢ KẾT QUẢ ===
        res.status(200).json({
            success: true,
            message: 'Cập nhật ưu đãi thành công',
            data: {
                ...promotion.toObject(),
                status: newStatus // Đảm bảo status realtime
            }
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật ưu đãi:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật ưu đãi'
        });
    }
};
const deletePromotion = async (req, res) => {
    try {
        // Xóa promotion
        const result = await Promotion.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ưu đãi'
            });
        }

        // Xóa các liên kết trong PromotionService
        await PromotionService.deleteMany({ promotionId: req.params.id });

        res.status(200).json({
            success: true,
            message: 'Đã xóa ưu đãi và các liên kết dịch vụ thành công',
        });
    } catch (error) {
        console.error('Lỗi khi xóa ưu đãi', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xóa ưu đãi'
        });
    }
};




module.exports = { createPromotion, getAllPromotions, viewDetailPromotion,updatePromotion, deletePromotion };
