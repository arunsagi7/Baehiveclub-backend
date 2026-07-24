const express = require('express');
const { verifyToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const eventsController = require('../controllers/eventsController');

const router = express.Router();

// Public routes (Website integration)
router.get('/', eventsController.getEvents);
router.get('/:id', eventsController.getEventById);

// Protected routes (Admin panel CRUD)
router.post('/', verifyToken, upload.single('image'), eventsController.createEvent);
router.put('/:id', verifyToken, upload.single('image'), eventsController.updateEvent);
router.delete('/:id', verifyToken, eventsController.deleteEvent);

module.exports = router;
