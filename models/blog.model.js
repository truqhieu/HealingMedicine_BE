const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title : {
        type : String,
        required: [true, 'Vui lòng điền tiêu đề của blog'],
        trim : true,
    },
    category :{
        type : String,
        enum : [
            "News",              
            "Health Tips",       
            "Medical Services",  
            "Promotions",        
            "Patient Stories",   
            "Recruitment" 
        ],
        required: [true, 'Vui điền thể loại của blog'],
        trim : true,
    },
    summary : {
        type : String,
        required : [true, 'Vui lòng điền tóm tắt blog'],
        trim : true,
    },
    thumbnailUrl : {
        type : String,
        required : [true, 'Vui lòng điền ảnh của blog blog'],
        trim : true,
    },
    authorUserId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status : {
        type : String,
        enum : ["Published","Hidden"],
        default : "Published",
    }
},{
  timestamps: true
});

module.exports = mongoose.model('Blog', blogSchema,'blogs');