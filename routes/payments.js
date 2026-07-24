const express = require('express');
const { verifyToken } = require('../middlewares/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Public routes for website ticket purchase flow
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);

// Protected route for Admin panel transaction list
router.get('/', verifyToken, paymentController.getPayments);

module.exports = router;
