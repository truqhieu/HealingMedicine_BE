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
        if(start < now) {
            return res.status(400).json({
                success : false,
                message : 'Ngày mua thiết bị phải tính từ hiện tại.'
            });           
        }
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
const getAllDevices = async(req,res) =>{
   try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if(status && STATUS.includes(status)) filter.status = status;

    if(search && String(search).trim().length > 0){
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regax = new RegExp(safe, 'i');
      filter.$or = [
        {name : {$regax : regax}},
        {description : {$regax : regax}},
      ]   
    } 

    const [total, devices] = await Promise.all([
      Device.countDocuments(filter),
      Device.find(filter)
      .skip(skip)
      .limit(limitNum)
      .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(total/limitNum));
    return res.status(200).json({
      status : true,
      total,
      totalPages,
      page : pageNum,
      limit : limitNum,
      data : devices
    })
    } catch (error) {
        console.log('Lỗi khi lấy danh sách thiết bị', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi lấy danh sách thiết bị trong phòng khám,'
        })
    }
}

const viewDetailDevice = async(req,res) =>{
  try {
    const detailDevice = await Device.findById(req.params.id);
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

const updateDevice = async(req,res) =>{
  try {
    const updateFileds = [
      'name',
      'description',
      'purchaseDate',
      'expireDate',
      'status'
    ]

    const updates = {};
    Object.keys(req.body).forEach(key =>{
      if(updateFileds.includes(key)){
        updates[key] = req.body[key];
      }

      else if(key === 'name'){
        const name = req.body[key];
          if (name) {
            // Kiểm tra không để trống
            if (typeof name !== 'string' || name.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị không được để trống'
              });
            }
            
            const cleanName = name.trim();
            
            if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanName)) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanName.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Tên thiết bị phải có ít nhất 2 ký tự'
              });
            }
            
            updates[key] = cleanName;
          }
      }
      else if(key === 'description'){
        const description = req.body[key];
          if (description) {
            // Kiểm tra không để trống
            if (typeof description !== 'string' || description.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị không được để trống'
              });
            }
            
            const cleanDescription = description.trim();
            
            if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanDescription)) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanDescription.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả thiết bị phải có ít nhất 2 ký tự'
              });
            }
            
            updates[key] = cleanDescription;
          }
      }

      else if(key === 'purchaseDate'){
        const purchaseDate = req.body[key]
        const now = new Date();
        const start = new Date(purchaseDate);
        const end = new Date(expireDate);

        if(isNaN(start.getTime())){
            return res.status(400).json({
                success : false,
                message : 'Ngày mua thiết bị không hợp lệ.'
            });
        }
        if(start < now) {
            return res.status(400).json({
                success : false,
                message : 'Ngày mua thiết bị phải tính từ hiện tại.'
            });           
        }
        if(end <= start){
            return res.status(400).json({
                success : false,
                message : 'Ngày hết hạn phải lớn hơn ngày bắt đầu mua.'
            });  
        }   
        updates[key] = purchaseDate
      }

      else if(key === 'expireDate'){
        const expireDate = req.body[key]
        const now = new Date();
        const start = new Date(purchaseDate);
        const end = new Date(expireDate);

        if(isNaN(end.getTime())){
            return res.status(400).json({
                success : false,
                message : 'Ngày hết hạn của thiết bị không hợp lệ.'
            });
        }
        if(end > now) {
            return res.status(400).json({
                success : false,
                message : 'Ngày hết hạn thiết bị phải tính từ hiện tại.'
            });           
        }
        if(end <= start){
            return res.status(400).json({
                success : false,
                message : 'Ngày hết hạn phải lớn hơn ngày bắt đầu mua.'
            });  
        }   
        updates[key] = expireDate
      }     
      

    });

    if(Object.keys(updates).length === 0){
      return res.status(400).json({
        success : false,
        message : 'Không có trường hợp lệ để cập nhật'
      })
    }

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      {$set : updates},
      {new : true, runValidators : true}
    );
    if(!device){
      return res.status(400).json({
        success : false,
        message : 'Không tìm thấy thiết bị'
      });
    }

    res.status(200).json({
      success : true,
      message : 'Cập nhật thông tin thiết bị thành công',
      data :device
    })
  } catch (error) {
    console.log('Lỗi khi cập nhật thông tin thiết bị', error);
    return res.status(500).json({
      success : false,
      message : 'Đã có lỗi khi cập nhật thông tin thiết bị của phòng khám'
    })
  }
}


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