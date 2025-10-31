const Service = require('../models/service.model');

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
updateService,
deleteService
}