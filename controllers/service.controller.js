const Service = require('../models/service.model');
const Promotion = require('../models/promotion.model')
const PromotionService = require('../models/promotionService.model')

const REPAID = Service.schema.path('isPrepaid').enumValues;
const STATUS = Service.schema.path('status').enumValues;
const CATEGORY = Service.schema.path('category').enumValues;
const createService = async (req, res) => {
  try {
    const { serviceName, description, price, isPrepaid, durationMinutes, category } = req.body;

    if (!serviceName || typeof serviceName !== 'string' || serviceName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên dịch vụ không được bỏ trống',
      });
    }

    const cleanServiceName = serviceName.trim();
    if (!/^[a-zA-ZÀ-ỹĐđ0-9\s]+$/.test(cleanServiceName)) {
      return res.status(400).json({
        success: false,
        message: 'Tên dịch vụ không hợp lệ',
      });
    }

    if (cleanServiceName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Độ dài tên dịch vụ không hợp lệ (tối thiểu 2 ký tự)',
      });
    }

    const existingService = await Service.findOne({ serviceName: cleanServiceName });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Tên dịch vụ đã tồn tại',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả dịch vụ không được bỏ trống',
      });
    }

    const cleanDescription = description.trim();
    if (!/^[a-zA-ZÀ-ỹĐđ0-9\s,.\-\/!@#%&()'"?:]+$/.test(cleanDescription)) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả dịch vụ không hợp lệ',
      });
    }

    if (cleanDescription.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Độ dài mô tả dịch vụ không hợp lệ (tối thiểu 4 ký tự)',
      });
    }

    if (price === undefined || price === null || price === '') {
      return res.status(400).json({
        success: false,
        message: 'Giá dịch vụ không được bỏ trống',
      });
    }

    if (typeof price !== 'number' || isNaN(price)) {
      return res.status(400).json({
        success: false,
        message: 'Giá dịch vụ phải là số nguyên dương',
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá dịch vụ không được âm',
      });
    }

    if (!category || !CATEGORY.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Thể loại dịch vụ không hợp lệ',
      });
    }

    if(category !== 'Consultation'){
   if (durationMinutes === undefined || durationMinutes === null) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian làm dịch vụ không được bỏ trống',
      });
    } 
        if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian làm dịch vụ phải là số nguyên dương',
      });
    }

    if (durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian làm dịch vụ phải lớn hơn 0 phút',
      });
    }     
    }


    const finalDuration = category === 'Consultation' ? 30 : durationMinutes;
    const finalIsPrepaid = category === 'Consultation' ? true : !!isPrepaid;

    const newService = new Service({
      serviceName: cleanServiceName,
      description: cleanDescription,
      price,
      isPrepaid: finalIsPrepaid,
      durationMinutes: finalDuration,
      category,
    });

    await newService.save();

    res.status(201).json({
      success: true,
      message: `Dịch vụ ${cleanServiceName} đã được thêm mới.`,
      data: newService,
    });
  } catch (error) {
    console.error('Lỗi tạo dịch vụ:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo dịch vụ',
    });
  }
};


const getAllServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isPrepaid,
      status,
      category,
      search,
      sortPrice,
      sortTime,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (isPrepaid !== undefined) {
      filter.isPrepaid = isPrepaid === "true";
    }

    if (status) filter.status = status; 

    if (category) filter.category = category;

    if (search && String(search).trim().length > 0) {
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [{ serviceName: { $regex: regex } }];
    }

 const sortOption = [];

if (sortPrice) {
  sortOption.push(["price", sortPrice === "asc" ? 1 : -1]);
}

if (sortTime) {
  sortOption.push(["durationMinutes", sortTime === "asc" ? 1 : -1]);
}

if (sortOption.length === 0) {
  sortOption.push(["createdAt", -1]);
}


    const [total, services] = await Promise.all([
      Service.countDocuments(filter),
      Service.find(filter)
      .select('-__v')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    return res.status(200).json({
      success: true,
      total,
      totalPages,
      page: pageNum,
      limit: limitNum,
      data: services,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách dịch vụ:", error);
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi lấy danh sách dịch vụ",
    });
  }
};

const getDiscountedServices = async (req, res) => {
  try {
    const { 
      status,
      page = 1, 
      limit = 15,
      search,
      category,
      isPrepaid
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const now = new Date();

    // === 1. Lấy tất cả promotion (có thể filter status) ===
    const promoFilter = {};
    if (status) promoFilter.status = status;

    const promotions = await Promotion.find(promoFilter).lean();
    if (promotions.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page: pageNum,
        limit: limitNum,
        data: []
      });
    }

    const promoIds = promotions.map(p => p._id);

    // === 2. Lấy liên kết PromotionService ===
    const links = await PromotionService.find({
      promotionId: { $in: promoIds }
    }).lean();

    if (links.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page: pageNum,
        limit: limitNum,
        data: []
      });
    }

    const serviceIds = [...new Set(links.map(l => l.serviceId))];

    // === 3. XÂY DỰNG FILTER CHO SERVICE ===
    const serviceFilter = { _id: { $in: serviceIds } };

    if (isPrepaid !== undefined) {
      serviceFilter.isPrepaid = isPrepaid === 'true';
    }

    if (category) {
      serviceFilter.category = category;
    }

    if (search && String(search).trim().length > 0) {
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      serviceFilter.serviceName = { $regex: regex };
    }

    // === 4. Lấy thông tin dịch vụ (có filter) ===
    const services = await Service.find(serviceFilter)
      .select('serviceName price durationMinutes isPrepaid category')
      .lean();

    if (services.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page: pageNum,
        limit: limitNum,
        data: []
      });
    }

    const serviceMap = Object.fromEntries(
      services.map(s => [s._id.toString(), s])
    );

    // === 5. Gộp theo service + tính giá tốt nhất ===
    const serviceDiscountMap = {};

    for (const link of links) {
      const service = serviceMap[link.serviceId.toString()];
      if (!service) continue; // Đã bị loại bởi filter

      const promo = promotions.find(p => p._id.toString() === link.promotionId.toString());
      if (!promo) continue;

      const key = service._id.toString();
      if (!serviceDiscountMap[key]) {
        serviceDiscountMap[key] = {
          serviceId: service._id,
          serviceName: service.serviceName,
          originalPrice: service.price,
          durationMinutes: service.durationMinutes,
          isPrepaid: service.isPrepaid,
          category: service.category,
          promotions: []
        };
      }

      let finalPrice = service.price;
      if (promo.discountType === 'Percent') {
        finalPrice = service.price * (1 - promo.discountValue / 100);
      } else if (promo.discountType === 'Fix') {
        finalPrice = Math.max(0, service.price - promo.discountValue);
      }

      serviceDiscountMap[key].promotions.push({
        promotionId: promo._id,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        finalPrice: Math.round(finalPrice),
        status: promo.status,
        startDate: promo.startDate,
        endDate: promo.endDate
      });
    }

    // === 6. Tính giá tốt nhất cho mỗi service ===
    const result = Object.values(serviceDiscountMap).map(item => {
      const best = item.promotions.reduce((best, curr) => 
        curr.finalPrice < best.finalPrice ? curr : best
      );

      return {
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        originalPrice: item.originalPrice,
        durationMinutes: item.durationMinutes,
        isPrepaid: item.isPrepaid,
        category: item.category,
        bestPrice: best.finalPrice,
        saved: item.originalPrice - best.finalPrice,
        bestPromotion: {
          id: best.promotionId,
          title: best.title, 
        },
        // totalPromotions: item.promotions.length
      };
    });

    // === 7. Sắp xếp & phân trang ===
    result.sort((a, b) => b.saved - a.saved); // Giảm nhiều nhất trước

    const total = result.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = result.slice(start, start + limitNum);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      data: paginated
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách dịch vụ giảm giá', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách dịch vụ giảm giá'
    });
  }
};

const getDiscountedServiceDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    // 1. Lấy service
    const service = await Service.findById(id)
      .select('serviceName price durationMinutes')
      .lean();
    if (!service) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    // 2. Lấy tất cả liên kết
    const links = await PromotionService.find({ serviceId: id }).lean();
    if (links.length === 0) {
      return res.status(200).json({
        success: true,
        data: { ...service, allPromotions: [] }
      });
    }

    // 3. Lấy promotion
    const promotions = await Promotion.find({
      _id: { $in: links.map(l => l.promotionId) }
    }).lean();

    // 4. Tính giá cho từng promotion
    const allPromotions = promotions.map(promo => {
      let finalPrice = service.price;
      if (promo.discountType === 'Percent') {
        finalPrice = service.price * (1 - promo.discountValue / 100);
      } else if (promo.discountType === 'Fix') {
        finalPrice = Math.max(0, service.price - promo.discountValue);
      }

      return {
        promotionId: promo._id,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        finalPrice: Math.round(finalPrice),
        status: promo.status,
        startDate: promo.startDate,
        endDate: promo.endDate
      };
    });

    res.status(200).json({
      success: true,
      data: {
        serviceId: service._id,
        serviceName: service.serviceName,
        originalPrice: service.price,
        durationMinutes: service.durationMinutes,
        allPromotions
      }
    });

  } catch (error) {
    console.log('Lỗi khi xem chi tiết dịch vụ được giảm giá', error);
    return res.status(500).json({
      success : false,
      message : 'Đã xảy ra lỗi khi xem chi tiết dịch vụ được giảm giá'
    })
  }
};

const viewDetailService = async(req,res) =>{
    try {
        const detailService = await Service.findById(req.params.id)
        .select('-__v');
        if(!detailService){
            return res.status(400).json({
                success : false,
                message : 'Không tìm thấy dịch vụ'
            })
        }
        res.status(200).json({
            success : true,
            message : 'Chi tiết dịch vụ',
            data : detailService
        })
    } catch (error) {
        console.error('Lỗi xem chi tiết dịch vụ', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi xem chi tiết dịch vụ' });  
    }
}

const updateService = async (req, res) => {
  try {
    const { serviceName, description, price, isPrepaid, durationMinutes, category, status } = req.body;

    const existingService = await Service.findById(req.params.id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ',
      });
    }

    const updates = {};

    // --- Validate serviceName ---
    if (serviceName !== undefined) {
      const cleanServiceName = serviceName.trim();
      if (!cleanServiceName) {
        return res.status(400).json({
          success: false,
          message: 'Tên dịch vụ không được bỏ trống',
        });
      }
      if (!/^[a-zA-ZÀ-ỹĐđ0-9\s]+$/.test(cleanServiceName)) {
        return res.status(400).json({
          success: false,
          message: 'Tên dịch vụ không hợp lệ',
        });
      }
      if (cleanServiceName.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Độ dài tên dịch vụ không hợp lệ (tối thiểu 2 ký tự)',
        });
      }

      const duplicate = await Service.findOne({
        serviceName: cleanServiceName,
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Tên dịch vụ đã tồn tại',
        });
      }

      updates.serviceName = cleanServiceName;
    }

    // --- Validate description ---
    if (description !== undefined) {
      const cleanDescription = description.trim();
      if (!cleanDescription) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả dịch vụ không được để trống',
        });
      }
      if (!/^[a-zA-ZÀ-ỹĐđ0-9\s.,!]+$/.test(cleanDescription)) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả dịch vụ không hợp lệ',
        });
      }
      if (cleanDescription.length < 4) {
        return res.status(400).json({
          success: false,
          message: 'Độ dài mô tả dịch vụ không hợp lệ (tối thiểu 4 ký tự)',
        });
      }
      updates.description = cleanDescription;
    }

    // --- Validate price ---
    if (price !== undefined) {
      if (isNaN(price) || Number(price) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá dịch vụ phải là số nguyên dương',
        });
      }
      updates.price = Number(price);
    }

    // --- Validate isPrepaid ---
    if (isPrepaid !== undefined) {
      if (typeof isPrepaid !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Giá trị trả trước phải là true hoặc false',
        });
      }
      updates.isPrepaid = isPrepaid;
    }

    // --- Validate category ---
    if (category !== undefined) {
      const validCategories = ['Consultation', 'Examination'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Thể loại dịch vụ không hợp lệ. Chỉ chấp nhận: ${validCategories.join(', ')}`,
        });
      }
      updates.category = category;
    }

    // --- Validate durationMinutes ---
    if (durationMinutes !== undefined) {
      if (isNaN(durationMinutes) || Number(durationMinutes) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Thời gian làm dịch vụ phải là số dương (phút)',
        });
      }
      updates.durationMinutes = Number(durationMinutes);
    }

    // ✅ Logic tự động theo category
    if (category === 'Consultation') {
      updates.durationMinutes = 30;
      updates.isPrepaid = true;
    } else if (category === 'Examination') {
      updates.durationMinutes = 45; // bạn có thể đổi giá trị mặc định này
      updates.isPrepaid = false;
    }

    // --- Validate status ---
    if (status !== undefined) {
      const validStatus = ['Active', 'Inactive'];
      if (!validStatus.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatus.join(', ')}`,
        });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có trường hợp lệ để cập nhật',
      });
    }

    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin dịch vụ thành công',
      data: updatedService,
    });
  } catch (error) {
    console.error('Lỗi cập nhật dịch vụ:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi khi cập nhật thông tin dịch vụ',
    });
  }
};


const deleteService = async(req,res) =>{
    try {
        const service = await Service.findByIdAndDelete(req.params.id)
        if(!service){
            return res.status(404).json({
                status : false,
                message : 'Không tìm thấy dịch vụ để xóa'
            })
        }
        res.status(200).json({
            status : true,
            message : 'Xóa dịch vụ thành công.'
        })
    } catch (error) {
        console.error('Lỗi xóa dịch vụ', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi xóa dịch vụ' });
    }
}

module.exports = {
createService,
getAllServices,
viewDetailService,
getDiscountedServiceDetail,
getDiscountedServices,
updateService,
deleteService
}