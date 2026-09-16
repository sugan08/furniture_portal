const express = require('express');
const db = require('../db/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply auth & admin middleware to all admin endpoints
router.use(verifyToken, requireAdmin);

// GET /api/admin/stats - KPI Summary dashboard metrics
router.get('/stats', async (req, res) => {
  try {
    const [rentalCounts] = await db.query(`
      SELECT 
        COUNT(*) AS total_rentals,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_rentals,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_rentals,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_rentals,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned_rentals,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_rentals,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_rent_total ELSE 0 END), 0) AS active_monthly_mrr
      FROM rentals
    `);

    const [itemCounts] = await db.query(`
      SELECT 
        COUNT(*) AS total_items,
        COALESCE(SUM(stock_quantity), 0) AS total_stock,
        SUM(CASE WHEN stock_quantity <= 2 THEN 1 ELSE 0 END) AS low_stock_items
      FROM furniture_items
    `);

    const [userCounts] = await db.query(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) AS total_customers
      FROM users
    `);

    const [recentRentals] = await db.query(`
      SELECT 
        r.id,
        r.rental_code,
        r.total_amount,
        r.status,
        r.tenure_months,
        r.created_at,
        u.name AS customer_name,
        u.email AS customer_email
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.id DESC
      LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        rentals: rentalCounts[0] || {},
        inventory: itemCounts[0] || {},
        users: userCounts[0] || {},
        recentRentals
      }
    });
  } catch (err) {
    console.error('Fetch admin stats error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch admin statistics.' });
  }
});

// GET /api/admin/rentals - List all rentals with filters
router.get('/rentals', async (req, res) => {
  try {
    const { status, search } = req.query;

    let sql = `
      SELECT 
        r.id,
        r.rental_code,
        r.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,
        r.tenure_months,
        r.start_date,
        r.end_date,
        r.monthly_rent_total,
        r.security_deposit_total,
        r.discount_amount,
        r.total_amount,
        r.status,
        r.delivery_address,
        r.notes,
        r.created_at
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (LOWER(r.rental_code) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY r.id DESC';

    const [rentals] = await db.query(sql, params);

    // Fetch items for each rental
    const enriched = [];
    for (const r of rentals) {
      const [items] = await db.query(`
        SELECT 
          ri.id,
          ri.furniture_id,
          ri.quantity,
          ri.monthly_rate,
          ri.security_deposit,
          f.name,
          f.image_url
        FROM rental_items ri
        JOIN furniture_items f ON ri.furniture_id = f.id
        WHERE ri.rental_id = ?
      `, [r.id]);

      enriched.push({
        ...r,
        items
      });
    }

    return res.json({ success: true, count: enriched.length, rentals: enriched });
  } catch (err) {
    console.error('Fetch admin rentals error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch rental orders.' });
  }
});

// PATCH /api/admin/rentals/:id/status - Transition order status
router.patch('/rentals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'active', 'returned', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid options are: ${validStatuses.join(', ')}`
      });
    }

    const [rows] = await db.query('SELECT * FROM rentals WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rental not found.' });
    }

    const currentRental = rows[0];
    const prevStatus = currentRental.status;

    // If order was active/pending/approved and is now returned or cancelled, restore inventory
    const isRestoring = (status === 'returned' || status === 'cancelled') &&
                        prevStatus !== 'returned' && prevStatus !== 'cancelled';

    // If order was cancelled/returned and is moved back to active/approved, deduct inventory
    const isDeducting = (status === 'active' || status === 'approved' || status === 'pending') &&
                        (prevStatus === 'returned' || prevStatus === 'cancelled');

    if (isRestoring) {
      const [items] = await db.query('SELECT furniture_id, quantity FROM rental_items WHERE rental_id = ?', [id]);
      for (const it of items) {
        await db.query(`
          UPDATE furniture_items 
          SET stock_quantity = stock_quantity + ? 
          WHERE id = ?
        `, [it.quantity, it.furniture_id]);
      }
    } else if (isDeducting) {
      const [items] = await db.query('SELECT furniture_id, quantity FROM rental_items WHERE rental_id = ?', [id]);
      for (const it of items) {
        await db.query(`
          UPDATE furniture_items 
          SET stock_quantity = stock_quantity - ? 
          WHERE id = ?
        `, [it.quantity, it.furniture_id]);
      }
    }

    await db.query('UPDATE rentals SET status = ? WHERE id = ?', [status, id]);

    return res.json({
      success: true,
      message: `Rental order #${currentRental.rental_code} status updated from '${prevStatus}' to '${status}'.`
    });
  } catch (err) {
    console.error('Update rental status error:', err);
    return res.status(500).json({ success: false, message: 'Could not update rental order status.' });
  }
});

// GET /api/admin/users - Customer registry
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.phone,
        u.address,
        u.created_at,
        COUNT(r.id) AS rental_count,
        COALESCE(SUM(CASE WHEN r.status != 'cancelled' THEN r.total_amount ELSE 0 END), 0) AS total_spent
      FROM users u
      LEFT JOIN rentals r ON u.id = r.user_id
      GROUP BY u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at
      ORDER BY u.id DESC
    `);

    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error('Fetch admin users error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch customer list.' });
  }
});

module.exports = router;
