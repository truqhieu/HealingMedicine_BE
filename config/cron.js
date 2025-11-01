// cron/promotion.cron.js
const cron = require('node-cron');
const Promotion = require('../models/promotion.model');

cron.schedule('*/1 * * * *', async () => {  // test: mỗi phút
// cron.schedule('0 0 * * *', async () => { // production: mỗi ngày 0h
    try {
        const now = new Date();
        const result = await Promotion.updateMany(
            { endDate: { $lt: now }, status: { $ne: 'Expired' } },
            { $set: { status: 'Expired' } }
        );
        if (result.modifiedCount > 0) {
            console.log(`✅ Cập nhật ${result.modifiedCount} khuyến mãi hết hạn.`);
        }
    } catch (error) {
        console.error('❌ Lỗi khi cập nhật khuyến mãi:', error);
    }
}, {
    timezone: "Asia/Ho_Chi_Minh"
});
