const express = require('express');
const db = require('../db/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Calculate tenure discount percentage:
 * - 12+ months: 15% discount
 * - 6-11 months: 10% discount
 * - 3-5 months: 5% discount
 * - 1-2 months: 0% discount
 */
function getDiscountRate(tenureMonths) {
  if (tenureMonths >= 12) return 0.15;
  if (tenureMonths >= 6) return 0.10;
  if (tenureMonths >= 3) return 0.05;
  return 0;
}

// POST /api/rentals - Book a new rental order
router.post('/', verifyToken, async (req, res) => {
  try {
    const { tenure_months, delivery_address, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your rental cart is empty. Please add items.' });
    }

    if (!delivery_address || delivery_address.trim() === '') {
      return res.status(400).json({ success: false, message: 'Delivery address is required.' });
    }

    const tenure = parseInt(tenure_months || 3, 10);
    if (isNaN(tenure) || tenure < 1 || tenure > 36) {
      return res.status(400).json({ success: false, message: 'Tenure must be between 1 and 36 months.' });
    }

    // Verify each item and check inventory
    let monthlyRentTotal = 0;
    let securityDepositTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const furnitureId = parseInt(item.furniture_id || item.id, 10);
      const qty = parseInt(item.quantity || 1, 10);

      if (isNaN(furnitureId) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid item data in cart.' });
      }

      const [furnRows] = await db.query('SELECT * FROM furniture_items WHERE id = ?', [furnitureId]);
      if (!furnRows || furnRows.length === 0) {
        return res.status(404).json({ success: false, message: `Furniture item #${furnitureId} not found.` });
      }

      const product = furnRows[0];
      if (product.stock_quantity < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${qty}`
        });
      }

      const itemMonthlyRate = parseFloat(product.monthly_rate);
      const itemDeposit = parseFloat(product.security_deposit);

      monthlyRentTotal += itemMonthlyRate * qty;
      securityDepositTotal += itemDeposit * qty;

      validatedItems.push({
        furniture_id: product.id,
        name: product.name,
        quantity: qty,
        monthly_rate: itemMonthlyRate,
        security_deposit: itemDeposit
      });
    }

    // Pricing calculation
    const discountRate = getDiscountRate(tenure);
    const grossRent = monthlyRentTotal * tenure;
    const discountAmount = Math.round(grossRent * discountRate * 100) / 100;
    const netRent = grossRent - discountAmount;
    const totalAmount = Math.round((netRent + securityDepositTotal) * 100) / 100;

    // Dates
    const startDate = new Date().toISOString().split('T')[0];
    const end = new Date();
    end.setMonth(end.getMonth() + tenure);
    const endDate = end.toISOString().split('T')[0];

    // Unique rental code
    const rentalCode = 'RNT-' + Math.floor(100000 + Math.random() * 900000);

    // Insert rental record
    const [rentalResult] = await db.query(`
      INSERT INTO rentals (
        rental_code, user_id, tenure_months, start_date, end_date,
        monthly_rent_total, security_deposit_total, discount_amount, total_amount,
        status, delivery_address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [
      rentalCode,
      req.user.id,
      tenure,
      startDate,
      endDate,
      monthlyRentTotal,
      securityDepositTotal,
      discountAmount,
      totalAmount,
      delivery_address.trim(),
      notes ? notes.trim() : null
    ]);

    const rentalId = rentalResult.insertId;

    // Insert rental items and decrease stock
    for (const vItem of validatedItems) {
      await db.query(`
        INSERT INTO rental_items (rental_id, furniture_id, quantity, monthly_rate, security_deposit)
        VALUES (?, ?, ?, ?, ?)
      `, [rentalId, vItem.furniture_id, vItem.quantity, vItem.monthly_rate, vItem.security_deposit]);

      await db.query(`
        UPDATE furniture_items 
        SET stock_quantity = stock_quantity - ? 
        WHERE id = ?
      `, [vItem.quantity, vItem.furniture_id]);
    }

    return res.status(201).json({
      success: true,
      message: 'Rental order booked successfully!',
      rental: {
        id: rentalId,
        rental_code: rentalCode,
        tenure_months: tenure,
        start_date: startDate,
        end_date: endDate,
        monthly_rent_total: monthlyRentTotal,
        security_deposit_total: securityDepositTotal,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        status: 'pending',
        delivery_address: delivery_address.trim(),
        item_count: validatedItems.length
      }
    });
  } catch (err) {
    console.error('Book rental error:', err);
    return res.status(500).json({ success: false, message: 'Server error while processing your rental order.' });
  }
});

// GET /api/rentals/my-rentals - Get current user's rental orders
router.get('/my-rentals', verifyToken, async (req, res) => {
  try {
    const [rentals] = await db.query(`
      SELECT * FROM rentals 
      WHERE user_id = ? 
      ORDER BY id DESC
    `, [req.user.id]);

    // Attach items to each rental
    const enrichedRentals = [];
    for (const r of rentals) {
      const [items] = await db.query(`
        SELECT 
          ri.id,
          ri.furniture_id,
          ri.quantity,
          ri.monthly_rate,
          ri.security_deposit,
          f.name,
          f.image_url,
          f.dimensions,
          f.material
        FROM rental_items ri
        JOIN furniture_items f ON ri.furniture_id = f.id
        WHERE ri.rental_id = ?
      `, [r.id]);

      enrichedRentals.push({
        ...r,
        items
      });
    }

    return res.json({ success: true, count: enrichedRentals.length, rentals: enrichedRentals });
  } catch (err) {
    console.error('Fetch my rentals error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch your rentals.' });
  }
});

// GET /api/rentals/:id - Get single rental order detail
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM rentals WHERE id = ?', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rental order not found.' });
    }

    const rental = rows[0];

    // Authorization check: User can only view their own rental, admin can view any
    if (rental.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied to this rental order.' });
    }

    const [items] = await db.query(`
      SELECT 
        ri.id,
        ri.furniture_id,
        ri.quantity,
        ri.monthly_rate,
        ri.security_deposit,
        f.name,
        f.image_url,
        f.dimensions,
        f.material
      FROM rental_items ri
      JOIN furniture_items f ON ri.furniture_id = f.id
      WHERE ri.rental_id = ?
    `, [rental.id]);

    const [userRows] = await db.query('SELECT id, name, email, phone FROM users WHERE id = ?', [rental.user_id]);

    return res.json({
      success: true,
      rental: {
        ...rental,
        customer: userRows && userRows.length > 0 ? userRows[0] : null,
        items
      }
    });
  } catch (err) {
    console.error('Fetch rental details error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch rental details.' });
  }
});

// PATCH /api/rentals/:id/cancel - Customer cancels a pending rental
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM rentals WHERE id = ?', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rental order not found.' });
    }

    const rental = rows[0];

    if (rental.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to cancel this order.' });
    }

    if (rental.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order with status "${rental.status}". Only pending orders can be cancelled.`
      });
    }

    // Restore inventory stock
    const [items] = await db.query('SELECT furniture_id, quantity FROM rental_items WHERE rental_id = ?', [rental.id]);
    for (const it of items) {
      await db.query(`
        UPDATE furniture_items 
        SET stock_quantity = stock_quantity + ? 
        WHERE id = ?
      `, [it.quantity, it.furniture_id]);
    }

    await db.query("UPDATE rentals SET status = 'cancelled' WHERE id = ?", [rental.id]);

    return res.json({
      success: true,
      message: 'Rental order cancelled successfully and inventory has been restored.'
    });
  } catch (err) {
    console.error('Cancel rental error:', err);
    return res.status(500).json({ success: false, message: 'Could not cancel rental order.' });
  }
});

module.exports = router;
