const express = require('express');
const db = require('../db/db');

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT 
        c.id, 
        c.name, 
        c.slug, 
        c.description, 
        c.icon, 
        c.image_url,
        COUNT(f.id) AS item_count
      FROM categories c
      LEFT JOIN furniture_items f ON c.id = f.category_id
      GROUP BY c.id, c.name, c.slug, c.description, c.icon, c.image_url
      ORDER BY c.id ASC
    `);

    return res.json({ success: true, categories });
  } catch (err) {
    console.error('Fetch categories error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch categories.' });
  }
});

module.exports = router;
