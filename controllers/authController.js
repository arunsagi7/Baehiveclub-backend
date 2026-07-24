const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const path = require('path');
const fs = require('fs');

// Helper — generate JWT
const generateToken = (admin) => {
  return jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Check email uniqueness
    const existing = await db.getAsync('SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.runAsync(
      'INSERT INTO admin_users (name, email, phone, password) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), phone || null, hashedPassword]
    );

    const admin = await db.getAsync('SELECT id, name, email, phone, profileImage, createdAt FROM admin_users WHERE id = ?', [result.lastID]);
    const token = generateToken(admin);

    res.status(201).json({ success: true, message: 'Account created successfully.', token, admin });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const admin = await db.getAsync('SELECT * FROM admin_users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(admin);
    const { password: _, ...adminData } = admin;

    res.json({ success: true, message: 'Login successful.', token, admin: adminData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const admin = await db.getAsync(
      'SELECT id, name, email, phone, profileImage, createdAt FROM admin_users WHERE id = ?',
      [req.admin.id]
    );
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    res.json({ success: true, admin });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const adminId = req.admin.id;

    // If email is changing, check uniqueness
    if (email) {
      const existing = await db.getAsync(
        'SELECT id FROM admin_users WHERE email = ? AND id != ?',
        [email.toLowerCase(), adminId]
      );
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
    }

    let profileImage;
    if (req.file) {
      profileImage = `/uploads/${req.file.filename}`;
      // Delete old image if exists
      const current = await db.getAsync('SELECT profileImage FROM admin_users WHERE id = ?', [adminId]);
      if (current && current.profileImage) {
        const oldPath = path.join(__dirname, '..', current.profileImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (email) { updates.push('email = ?'); params.push(email.toLowerCase().trim()); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (profileImage) { updates.push('profileImage = ?'); params.push(profileImage); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(adminId);
    await db.runAsync(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await db.getAsync(
      'SELECT id, name, email, phone, profileImage, createdAt FROM admin_users WHERE id = ?',
      [adminId]
    );
    res.json({ success: true, message: 'Profile updated.', admin: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const admin = await db.getAsync('SELECT * FROM admin_users WHERE id = ?', [req.admin.id]);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.runAsync('UPDATE admin_users SET password = ? WHERE id = ?', [hashedPassword, req.admin.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { signup, login, getProfile, updateProfile, changePassword, logout };
