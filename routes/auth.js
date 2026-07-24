const express = require('express');
const { body } = require('express-validator');
const { verifyToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const authController = require('../controllers/authController');

const router = express.Router();

// Public auth routes
router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], authController.signup);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], authController.login);

// Protected auth routes
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile', verifyToken, upload.single('profileImage'), authController.updateProfile);
router.put('/change-password', verifyToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], authController.changePassword);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
