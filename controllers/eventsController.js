const db = require('../database/db');
const path = require('path');
const fs = require('fs');

// Helper — build image URL
const getImageUrl = (req, imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  return `${req.protocol}://${req.get('host')}${imagePath}`;
};

// GET /api/events
const getEvents = async (req, res) => {
  try {
    const { search, status, category, featured, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

    let sql = 'SELECT * FROM events WHERE isDeleted = 0';
    const params = [];

    if (search) {
      sql += ' AND (title LIKE ? OR location LIKE ? OR organizer LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (featured !== undefined) {
      sql += ' AND featured = ?';
      params.push(featured === 'true' ? 1 : 0);
    }

    // Total count
    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM (${sql})`, params);
    const total = countResult.total;

    // Allowed sort columns (prevent SQL injection)
    const allowedSorts = ['id', 'title', 'date', 'price', 'createdAt', 'remainingSeats'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortCol} ${sortOrder}`;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const events = await db.allAsync(sql, params);

    const enriched = events.map((e) => ({
      ...e,
      tags: e.tags ? JSON.parse(e.tags) : [],
      featured: e.featured === 1,
      imageUrl: getImageUrl(req, e.image),
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  try {
    const event = await db.getAsync('SELECT * FROM events WHERE id = ? AND isDeleted = 0', [req.params.id]);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const registrationCount = await db.getAsync(
      "SELECT COUNT(*) as count, SUM(tickets) as totalTickets FROM registrations WHERE eventId = ? AND paymentStatus = 'completed'",
      [event.id]
    );

    res.json({
      success: true,
      data: {
        ...event,
        tags: event.tags ? JSON.parse(event.tags) : [],
        featured: event.featured === 1,
        imageUrl: getImageUrl(req, event.image),
        registrations: registrationCount.count || 0,
        totalTicketsSold: registrationCount.totalTickets || 0,
      },
    });
  } catch (err) {
    console.error('Get event by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// POST /api/events
const createEvent = async (req, res) => {
  try {
    const {
      title, description, category, location, venue, date, startTime, endTime,
      price, totalSeats, organizer, phone, email, status, featured, tags,
      requirements, mapLink,
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Title and date are required.' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const seats = parseInt(totalSeats, 10) || 0;
    const tagsJson = tags ? JSON.stringify(Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : '[]';

    const result = await db.runAsync(
      `INSERT INTO events (title, description, category, image, location, venue, date,
        startTime, endTime, price, totalSeats, remainingSeats, organizer, phone, email,
        status, featured, tags, requirements, mapLink)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(), description || null, category || 'General', imagePath,
        location || null, venue || null, date, startTime || null, endTime || null,
        parseFloat(price) || 0, seats, seats,
        organizer || null, phone || null, email || null,
        status || 'upcoming', featured === 'true' || featured === true ? 1 : 0,
        tagsJson, requirements || null, mapLink || null,
      ]
    );

    const event = await db.getAsync('SELECT * FROM events WHERE id = ?', [result.lastID]);
    res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: { ...event, tags: JSON.parse(event.tags || '[]'), featured: event.featured === 1, imageUrl: getImageUrl(req, event.image) },
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// PUT /api/events/:id
const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const existing = await db.getAsync('SELECT * FROM events WHERE id = ? AND isDeleted = 0', [eventId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const {
      title, description, category, location, venue, date, startTime, endTime,
      price, totalSeats, remainingSeats, organizer, phone, email, status, featured,
      tags, requirements, mapLink,
    } = req.body;

    let imagePath = existing.image;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      // Delete old image
      if (existing.image) {
        const oldPath = path.join(__dirname, '..', existing.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const tagsJson = tags
      ? JSON.stringify(Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim()))
      : existing.tags;

    await db.runAsync(
      `UPDATE events SET
        title = ?, description = ?, category = ?, image = ?, location = ?, venue = ?,
        date = ?, startTime = ?, endTime = ?, price = ?, totalSeats = ?, remainingSeats = ?,
        organizer = ?, phone = ?, email = ?, status = ?, featured = ?, tags = ?,
        requirements = ?, mapLink = ?
       WHERE id = ?`,
      [
        title || existing.title,
        description !== undefined ? description : existing.description,
        category || existing.category,
        imagePath,
        location !== undefined ? location : existing.location,
        venue !== undefined ? venue : existing.venue,
        date || existing.date,
        startTime !== undefined ? startTime : existing.startTime,
        endTime !== undefined ? endTime : existing.endTime,
        price !== undefined ? parseFloat(price) : existing.price,
        totalSeats !== undefined ? parseInt(totalSeats, 10) : existing.totalSeats,
        remainingSeats !== undefined ? parseInt(remainingSeats, 10) : existing.remainingSeats,
        organizer !== undefined ? organizer : existing.organizer,
        phone !== undefined ? phone : existing.phone,
        email !== undefined ? email : existing.email,
        status || existing.status,
        featured !== undefined ? (featured === 'true' || featured === true ? 1 : 0) : existing.featured,
        tagsJson,
        requirements !== undefined ? requirements : existing.requirements,
        mapLink !== undefined ? mapLink : existing.mapLink,
        eventId,
      ]
    );

    const updated = await db.getAsync('SELECT * FROM events WHERE id = ?', [eventId]);
    res.json({
      success: true,
      message: 'Event updated successfully.',
      data: { ...updated, tags: JSON.parse(updated.tags || '[]'), featured: updated.featured === 1, imageUrl: getImageUrl(req, updated.image) },
    });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// DELETE /api/events/:id (soft delete)
const deleteEvent = async (req, res) => {
  try {
    const event = await db.getAsync('SELECT id FROM events WHERE id = ? AND isDeleted = 0', [req.params.id]);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await db.runAsync('UPDATE events SET isDeleted = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getEvents, getEventById, createEvent, updateEvent, deleteEvent };
