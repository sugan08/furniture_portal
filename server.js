const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db/db');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const furnitureRoutes = require('./routes/furniture');
const rentalRoutes = require('./routes/rentals');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dbEngine: db.getDbMode(),
    service: 'Online Furniture Rental Portal API'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/furniture', furnitureRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/admin', adminRoutes);

// Fallback to index.html for frontend client routing
app.get('*', (req, res) => {
  // If API request not found, return JSON 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: `Endpoint '${req.path}' not found.` });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
async function startServer() {
  try {
    await db.initDB();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🛋️  Online Furniture Rental Portal is running!`);
      console.log(`🌐 Local Portal URL: http://localhost:${PORT}`);
      console.log(`🔌 Database Mode   : ${db.getDbMode().toUpperCase()}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

app.startServer = startServer;
module.exports = app;
