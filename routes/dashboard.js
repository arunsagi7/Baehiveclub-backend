const express = require('express');
const { verifyToken } = require('../middlewares/auth');
const { getDashboardStats } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', verifyToken, getDashboardStats);

module.exports = router;
