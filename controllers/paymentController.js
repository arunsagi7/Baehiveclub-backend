const crypto = require('crypto');
const db = require('../database/db');
const razorpay = require('../config/razorpay');
const { createTicket } = require('../lib/ticket');
const { sendTicketMail } = require('../lib/mail');

// Helper to double check signature validity manually if needed
const verifyRazorpaySignature = (orderId, paymentId, signature, secret) => {
  const text = orderId + '|' + paymentId;
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(text)
    .digest('hex');
  return generated_signature === signature;
};

// POST /api/payment/create-order
const createOrder = async (req, res) => {
  try {
    const { eventId, name, email, phone, address, tickets } = req.body;

    if (!eventId || !name || !email || !tickets) {
      return res.status(400).json({ success: false, message: 'Missing required registration details.' });
    }

    // Fetch event details to calculate price and check seats
    const event = await db.getAsync('SELECT * FROM events WHERE id = ? AND isDeleted = 0', [eventId]);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({ success: false, message: 'This event is no longer active for registration.' });
    }

    const ticketCount = parseInt(tickets, 10);
    if (ticketCount <= 0) {
      return res.status(400).json({ success: false, message: 'Tickets must be at least 1.' });
    }

    if (event.remainingSeats < ticketCount) {
      return res.status(400).json({ success: false, message: `Only ${event.remainingSeats} seats available.` });
    }

    const amount = event.price * ticketCount;

    // Handle free events directly or if Razorpay is not active (offline testing fallback)
    if (amount <= 0 || !razorpay) {
      // Mock order generation for free events or local development fallback without payment gateway keys
      const mockOrderId = `order_mock_${Date.now()}`;
      
      // Store pending registration
      const result = await db.runAsync(
        `INSERT INTO registrations (eventId, name, email, phone, address, tickets, amount, orderId, paymentStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventId, name, email, phone || null, address || null, ticketCount, amount, mockOrderId, amount <= 0 ? 'completed' : 'pending']
      );

      // If free event, update seats immediately
      if (amount <= 0) {
        await db.runAsync('UPDATE events SET remainingSeats = remainingSeats - ? WHERE id = ?', [ticketCount, eventId]);
      }

      return res.json({
        success: true,
        isFree: amount <= 0,
        isMock: amount > 0 && !razorpay,
        orderId: mockOrderId,
        amount: amount * 100, // paise
        currency: 'INR',
        registrationId: result.lastID,
      });
    }

    // Create real Razorpay order
    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: 'INR',
      receipt: `receipt_evt_${eventId}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // Save registration with status 'pending'
    await db.runAsync(
      `INSERT INTO registrations (eventId, name, email, phone, address, tickets, amount, orderId, paymentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, name, email, phone || null, address || null, ticketCount, amount, order.id, 'pending']
    );

    res.json({
      success: true,
      isFree: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, message: 'Order ID and Payment ID are required.' });
    }

    // Find registration record
    const registration = await db.getAsync('SELECT * FROM registrations WHERE orderId = ?', [orderId]);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration record not found.' });
    }

    const event = await db.getAsync('SELECT * FROM events WHERE id = ?', [registration.eventId]);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Associated event not found.' });
    }

    if (registration.paymentStatus === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already verified and completed.',
        ticket: registration.ticket_no,
      });
    }

    // Verify payment authenticity
    let verified = false;
    if (orderId.startsWith('order_mock_')) {
      // Mock payment bypass (for development with missing keys)
      verified = true;
    } else {
      if (!signature) {
        return res.status(400).json({ success: false, message: 'Signature is required for production payments.' });
      }
      
      if (razorpay) {
        verified = verifyRazorpaySignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET);
      }
    }

    if (!verified) {
      // Update registration as failed
      await db.runAsync(
        "UPDATE registrations SET paymentStatus = 'failed', paymentId = ?, signature = ? WHERE orderId = ?",
        [paymentId, signature || null, orderId]
      );
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    // Generate Ticket Number & Booking Details
    const ticketNo = "EVT-" + Date.now();
    const booking = {
      name: registration.name,
      email: registration.email,
      event: event.title,
      ticket_no: ticketNo
    };

    // Insert into bookings table
    await db.runAsync(
      `INSERT INTO bookings (name, email, event, ticket_no) VALUES (?, ?, ?, ?)`,
      [booking.name, booking.email, booking.event, booking.ticket_no]
    );

    // Complete transaction in DB registrations & update seats
    await db.runAsync(
      "UPDATE registrations SET paymentStatus = 'completed', paymentId = ?, signature = ?, ticket_no = ? WHERE orderId = ?",
      [paymentId, signature || null, ticketNo, orderId]
    );

    await db.runAsync(
      'UPDATE events SET remainingSeats = remainingSeats - ? WHERE id = ?',
      [registration.tickets, registration.eventId]
    );

    // Generate PDF & Send Email
    try {
      const pdf = await createTicket(booking);
      await sendTicketMail(booking.email, booking.name, pdf);
    } catch (ticketErr) {
      console.error("Error creating or sending ticket PDF:", ticketErr);
    }

    res.json({
      success: true,
      message: 'Payment verified and ticket sent successfully!',
      ticket: ticketNo,
      booking: booking
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: 'Payment verification error.' });
  }
};


// GET /api/payments (Admin panel payment records view)
const getPayments = async (req, res) => {
  try {
    const { search, paymentStatus, page = 1, limit = 10 } = req.query;

    let sql = `
      SELECT r.*, e.title as eventName 
      FROM registrations r
      JOIN events e ON r.eventId = e.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (r.name LIKE ? OR r.email LIKE ? OR r.phone LIKE ? OR r.orderId LIKE ? OR r.paymentId LIKE ? OR e.title LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    if (paymentStatus) {
      sql += ' AND r.paymentStatus = ?';
      params.push(paymentStatus);
    }

    // Get count for pagination
    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM (${sql})`, params);
    const total = countResult.total;

    sql += ' ORDER BY r.createdAt DESC';

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const payments = await db.allAsync(sql, params);

    res.json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { createOrder, verifyPayment, getPayments };
