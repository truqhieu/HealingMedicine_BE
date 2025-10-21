
// HARDCODE TẠM THỜI ĐỂ TEST (sẽ xóa sau)
const HARDCODED_TOKEN ='9KOJ6C17AUPPOR8QTQXFEK8MQ5MUIDNPUYULG97JGHYSZE2WNGFKSVW1AJCBOTZR';

// Debug
console.log('🔍 DEBUG SEPAY CONFIG:');
console.log('   - SEPAY_API_TOKEN từ .env:', process.env.SEPAY_API_TOKEN ? 'CÓ (' + process.env.SEPAY_API_TOKEN.substring(0, 10) + '...)' : 'KHÔNG CÓ');
console.log('   - SEPAY_ACCOUNT_NUMBER từ .env:', process.env.SEPAY_ACCOUNT_NUMBER || 'KHÔNG CÓ');
console.log('   - Dùng HARDCODED TOKEN:', HARDCODED_TOKEN ? 'CÓ (' + HARDCODED_TOKEN.substring(0, 10) + '...)' : 'KHÔNG');

const sepayConfig = {
  // Thông tin tài khoản ngân hàng nhận tiền
  accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '3950450728',
  accountName: process.env.SEPAY_ACCOUNT_NAME || 'PHONG KHAM RANG HAM MAT HAI ANH',
  bankCode: process.env.SEPAY_BANK_CODE || 'BIDV',
  
  // API Token - DÙNG HARDCODE TẠM THỜI
  apiToken: process.env.SEPAY_API_TOKEN || HARDCODED_TOKEN,
  
  // API Endpoints
  apiBaseUrl: 'https://my.sepay.vn/userapi',
  
  // QR Code settings
  qrTemplate: 'compact2', // compact, compact2, print, qr_only
  
  // Payment timeout (15 phút)
  paymentTimeoutMinutes: 15,
  
  // Webhook URL (để nhận thông báo từ Sepay khi có giao dịch)
  webhookUrl: process.env.SEPAY_WEBHOOK_URL || 'https://yourdomain.com/api/payments/webhook/sepay'
};

// Danh sách mã ngân hàng Việt Nam
const BANK_CODES = {
  MB: 'MBBank',
  VCB: 'Vietcombank',
  TCB: 'Techcombank',
  ACB: 'ACB',
  VPB: 'VPBank',
  TPB: 'TPBank',
  STB: 'Sacombank',
  VIB: 'VIB',
  SHB: 'SHB',
  EIB: 'Eximbank',
  MSB: 'MSB',
  BIDV: 'BIDV',
  OCB: 'OCB',
  SCB: 'SCB',
  NAB: 'NamABank',
  VBA: 'VietABank',
  ABB: 'ABBANK',
  PGB: 'PGBank',
  GPB: 'GPBank',
  BAB: 'BacABank',
  CAKE: 'CAKE by VPBank',
  TIMO: 'Timo by VPBank',
  VIET: 'ViettelMoney'
};

// Validate config
const validateSepayConfig = () => {
  const errors = [];
  
  if (!sepayConfig.accountNumber || sepayConfig.accountNumber === '0123456789') {
    errors.push('SEPAY_ACCOUNT_NUMBER chưa được cấu hình');
  }
  
  if (!sepayConfig.accountName || sepayConfig.accountName === 'PHONG KHAM RANG HAI ANH') {
    errors.push('SEPAY_ACCOUNT_NAME chưa được cấu hình');
  }
  
  if (!sepayConfig.apiToken) {
    errors.push('SEPAY_API_TOKEN chưa được cấu hình');
  }
  
  if (!BANK_CODES[sepayConfig.bankCode]) {
    errors.push(`Bank code "${sepayConfig.bankCode}" không hợp lệ`);
  }
  
  if (errors.length > 0) {
    console.warn('⚠️  Cảnh báo Sepay Config:');
    errors.forEach(err => console.warn(`   - ${err}`));
  }
  
  return errors.length === 0;
};

module.exports = {
  sepayConfig,
  BANK_CODES,
  validateSepayConfig
};

