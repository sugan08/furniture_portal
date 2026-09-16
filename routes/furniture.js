const express = require('express');
const db = require('../db/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/furniture - Catalog with query filters
router.get('/', async (req, res) => {
  try {
    const { category, search, featured, max_price, sort } = req.query;

    let sql = `
      SELECT 
        f.id,
        f.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        f.name,
        f.description,
        f.monthly_rate,
        f.security_deposit,
        f.dimensions,
        f.material,
        f.stock_quantity,
        f.image_url,
        f.featured,
        f.created_at
      FROM furniture_items f
      JOIN categories c ON f.category_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (category) {
      if (!isNaN(category)) {
        sql += ` AND f.category_id = ?`;
        params.push(parseInt(category, 10));
      } else {
        sql += ` AND c.slug = ?`;
        params.push(category);
      }
    }

    if (search && search.trim() !== '') {
      sql += ` AND (LOWER(f.name) LIKE ? OR LOWER(f.description) LIKE ? OR LOWER(f.material) LIKE ?)`;
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    if (featured !== undefined && featured !== '') {
      sql += ` AND f.featured = ?`;
      params.push(featured === 'true' || featured === '1' ? 1 : 0);
    }

    if (max_price && !isNaN(max_price)) {
      sql += ` AND f.monthly_rate <= ?`;
      params.push(parseFloat(max_price));
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        sql += ` ORDER BY f.monthly_rate ASC`;
        break;
      case 'price_desc':
        sql += ` ORDER BY f.monthly_rate DESC`;
        break;
      case 'name_asc':
        sql += ` ORDER BY f.name ASC`;
        break;
      case 'newest':
      default:
        sql += ` ORDER BY f.id DESC`;
        break;
    }

    const [items] = await db.query(sql, params);
    return res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error('Fetch furniture error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch furniture catalog.' });
  }
});

// GET /api/furniture/:id - Single item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        f.id,
        f.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        f.name,
        f.description,
        f.monthly_rate,
        f.security_deposit,
        f.dimensions,
        f.material,
        f.stock_quantity,
        f.image_url,
        f.featured,
        f.created_at
      FROM furniture_items f
      JOIN categories c ON f.category_id = c.id
      WHERE f.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Furniture item not found.' });
    }

    return res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error('Fetch item error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching item details.' });
  }
});

// POST /api/furniture - Admin create item
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      monthly_rate,
      security_deposit,
      dimensions,
      material,
      stock_quantity,
      image_url,
      featured
    } = req.body;

    if (!category_id || !name || monthly_rate === undefined || security_deposit === undefined) {
      return res.status(400).json({ success: false, message: 'Category, name, monthly rate, and security deposit are required.' });
    }

    const [result] = await db.query(`
      INSERT INTO furniture_items 
      (category_id, name, description, monthly_rate, security_deposit, dimensions, material, stock_quantity, image_url, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parseInt(category_id, 10),
      name.trim(),
      description || '',
      parseFloat(monthly_rate),
      parseFloat(security_deposit),
      dimensions || 'Standard',
      material || 'Mixed Materials',
      parseInt(stock_quantity || 1, 10),
      image_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
      featured ? 1 : 0
    ]);

    return res.status(201).json({
      success: true,
      message: 'Furniture item created successfully!',
      itemId: result.insertId
    });
  } catch (err) {
    console.error('Create item error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create furniture item.' });
  }
});

// PUT /api/furniture/:id - Admin update item
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      name,
      description,
      monthly_rate,
      security_deposit,
      dimensions,
      material,
      stock_quantity,
      image_url,
      featured
    } = req.body;

    const [existing] = await db.query('SELECT id FROM furniture_items WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Furniture item not found.' });
    }

    await db.query(`
      UPDATE furniture_items SET
        category_id = ?,
        name = ?,
        description = ?,
        monthly_rate = ?,
        security_deposit = ?,
        dimensions = ?,
        material = ?,
        stock_quantity = ?,
        image_url = ?,
        featured = ?
      WHERE id = ?
    `, [
      parseInt(category_id, 10),
      name.trim(),
      description,
      parseFloat(monthly_rate),
      parseFloat(security_deposit),
      dimensions,
      material,
      parseInt(stock_quantity, 10),
      image_url,
      featured ? 1 : 0,
      id
    ]);

    return res.json({ success: true, message: 'Furniture item updated successfully!' });
  } catch (err) {
    console.error('Update item error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update furniture item.' });
  }
});

// DELETE /api/furniture/:id - Admin delete item
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query('SELECT id FROM furniture_items WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Furniture item not found.' });
    }

    await db.query('DELETE FROM furniture_items WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Furniture item deleted successfully.' });
  } catch (err) {
    console.error('Delete item error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete furniture item.' });
  }
});

module.exports = router;
