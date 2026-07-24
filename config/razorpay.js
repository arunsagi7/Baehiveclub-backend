const Razorpay = require('razorpay');

let razorpayInstance = null;

try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
  } else {
    console.warn('⚠️ Razorpay credentials missing from environment. Using mock checkout flow.');
  }
} catch (err) {
  console.error('❌ Failed to initialize Razorpay SDK:', err.message);
}

module.exports = razorpayInstance;
