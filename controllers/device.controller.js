const User = require('../models/user.model');
const Device = require('../models/device.model');

const createDevice = async(req,res) =>{
    try {
        const {name, description, purchaseDate, expireDate} = req.body;
        if(!name || !description || !purchaseDate || !expireDate){
            return res.status(404).json({
                success : false,
                message : 'Vui lòng không để trống các trường nhập'
            })
        }
        if (name) {
            if (typeof name !== 'string' || name.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị không được để trống'
              });
            }
            
            const cleanName = name.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanName)) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 3 ký tự)
            if (cleanName.length < 3) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị phải có ít nhất 3 ký tự'
              });
            }
        }
       if (description) {
            if (typeof description !== 'string' || description.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị không được để trống'
              });
            }
            
            const cleanDescription = description.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanDescription)) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị không được chứa ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 3 ký tự)
            if (cleanDescription.length < 3) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị phải có ít nhất 3 ký tự'
              });
            }
        }
        const now = new Date();
        const start = new Date(purchaseDate);
        const end = new Date(expireDate);

        if(isNaN(start.getTime())){
            return res.status(400).json({
                success : false,
                message : 'Ngày mua thiết bị không hợp lệ.'
            });
        }
        // if(start < now) {
        //     return res.status(400).json({
        //         success : false,
        //         message : 'Ngày mua thiết bị phải tính từ hiện tại.'
        //     });           
        // }
        if(end <= start){
            return res.status(400).json({
                success : false,
                message : 'Ngày hết hạn phải lớn hơn ngày bắt đầu mua.'
            });  
        }  
        
        const newDevice = new Device({
            name,
            description,
            purchaseDate,
            expireDate
        })

        await newDevice.save()
        res.status(201).json({
            success : true, 
            message : 'Tạo thiết bị mới thành công',
            data : newDevice
        })
    } catch (error) {
        console.log('Lỗi khi tạo thiết bị mới', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi tạo thiết bị mới cho phòng khám'
        })
    }
}
const STATUS = Device.schema.path('status').enumValues;
const getAllDevices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sort = 'desc',
      startDate,
      endDate
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    // Lọc theo trạng thái (nếu có)
    if (status && STATUS.includes(status)) filter.status = status;

    // 🔍 Tìm kiếm theo tên hoặc mô tả
    if (search && String(search).trim().length > 0) {
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filter.$or = [
        { name: { $regex: regex } },
        { description: { $regex: regex } },
      ];
    }

    const now = new Date();
    await Device.updateMany(
      { expireDate: { $lt: now }, status: { $ne: 'Inactive' } },
      { $set: { status: 'Inactive' } }
    );
    // 📅 Lọc theo khoảng thời gian mua (startDate – endDate)
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start)) filter.purchaseDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end)) filter.purchaseDate.$lte = end;
      }
    }

    // 🔽 Sắp xếp theo ngày mua (purchaseDate)
    const sortOrder = sort.toLowerCase() === 'asc' ? 1 : -1;

    // Thực hiện song song count + lấy dữ liệu
    const [total, devices] = await Promise.all([
      Device.countDocuments(filter),
      Device.find(filter)
        .select('-__v')
        .sort({ purchaseDate: sortOrder }) // ✅ Sắp xếp
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
      data: devices
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thiết bị', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách thiết bị trong phòng khám.'
    });
  }
};


const viewDetailDevice = async(req,res) =>{
  try {
    const detailDevice = await Device.findById(req.params.id).select('-__v');
    if(!detailDevice){
      return res.status(404).json({
        success : false,
        message : 'Thiết bị không tồn tại'
      })
    }
    res.status(200).json({
      success : true,
      message : 'Chi tiết thiêt bị',
      data : detailDevice,
    })
  } catch (error) {
        console.log('Lỗi khi xem chi tiết thiết bị', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi xem chi tiết thiết bị trong phòng khám,'
        })    
  }
}

const updateDevice = async (req, res) => {
  try {
    const { name, description, purchaseDate, expireDate, status } = req.body;

    const updates = {};

    // ✅ Validate name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tên thiết bị không được để trống',
        });
      }

      const cleanName = name.trim();
      if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanName)) {
        return res.status(400).json({
          success: false,
          message: 'Tên thiết bị không được chứa ký tự đặc biệt',
        });
      }

      if (cleanName.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Tên thiết bị phải có ít nhất 3 ký tự',
        });
      }

      updates.name = cleanName;
    }

    // ✅ Validate description
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả thiết bị không được để trống',
        });
      }

      const cleanDescription = description.trim();
      if (!/^[a-zA-ZÀ-ỹ0-9\s.,!?;:'"()_-]+$/.test(cleanDescription)) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả thiết bị không hợp lệ',
        });
      }

      if (cleanDescription.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả thiết bị phải có ít nhất 3 ký tự',
        });
      }

      updates.description = cleanDescription;
    }

    // ✅ Validate purchaseDate và expireDate
    let start, end;
    if (purchaseDate !== undefined) {
      start = new Date(purchaseDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày mua thiết bị không hợp lệ',
        });
      }
      updates.purchaseDate = start;
    }

    if (expireDate !== undefined) {
      end = new Date(expireDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày hết hạn thiết bị không hợp lệ',
        });
      }
      updates.expireDate = end;
    }

    // ✅ Kiểm tra quan hệ giữa start và end (nếu cả hai đều có)
    if (updates.purchaseDate && updates.expireDate) {
      if (updates.expireDate <= updates.purchaseDate) {
        return res.status(400).json({
          success: false,
          message: 'Ngày hết hạn phải lớn hơn ngày mua thiết bị',
        });
      }
    }

    // ✅ Validate status (nếu có)
    if (status !== undefined) {
      const validStatuses = ['Active', 'Inactive']
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái thiết bị không hợp lệ',
        });
      }
      updates.status = status;
    }

    // Không có trường hợp lệ
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có trường hợp lệ để cập nhật',
      });
    }

    // ✅ Cập nhật vào DB
    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thiết bị',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thiết bị thành công',
      data: device,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thiết bị:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi cập nhật thiết bị của phòng khám',
    });
  }
};



const deleteDevice = async(req,res) =>{
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if(!device){
      return res.status(404).json({
        success : false,
        message : 'Không tìm thấy thiết bị'
      })
    }
    res.status(200).json({
      success : true,
      message : 'Xóa thiết bị khỏi phòng khám thành công'
    })
  } catch (error) {
    console.log('Lỗi khi xóa thiết bị', error);
    return res.status(500).json({
      success : false,
      message : 'Đã có lỗi khi xóa thiết bị khỏi phòng khám'
    })    
  }
}

module.exports = {createDevice, getAllDevices, viewDetailDevice, updateDevice, deleteDevice}