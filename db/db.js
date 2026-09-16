const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let pool = null;
let sqliteDb = null;
let dbMode = 'uninitialized';

const initialCategories = [
  {
    id: 1,
    name: 'Living Room',
    slug: 'living-room',
    description: 'Plush sofas, coffee tables, accent chairs, and entertainment centers.',
    icon: 'fa-couch',
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 2,
    name: 'Bedroom',
    slug: 'bedroom',
    description: 'Comfortable beds, wardrobes, side tables, and orthopedic mattresses.',
    icon: 'fa-bed',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 3,
    name: 'Dining Room',
    slug: 'dining-room',
    description: 'Modern dining sets, wooden tables, and comfortable dining chairs.',
    icon: 'fa-utensils',
    image_url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 4,
    name: 'Home Office',
    slug: 'home-office',
    description: 'Ergonomic chairs, height-adjustable desks, and workstation setups.',
    icon: 'fa-briefcase',
    image_url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 5,
    name: 'Storage & Decor',
    slug: 'storage-decor',
    description: 'Bookshelves, shoe racks, floor lamps, and multi-utility storage units.',
    icon: 'fa-boxes-stacked',
    image_url: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80'
  }
];

const initialFurniture = [
  {
    id: 1,
    category_id: 1,
    name: 'Nordic Velvet 3-Seater Sofa',
    description: 'Scandinavian minimalist sofa wrapped in premium stain-resistant velvet fabric with tapered solid oak legs and high-density foam cushions.',
    monthly_rate: 799.00,
    security_deposit: 1500.00,
    dimensions: '82" W x 34" D x 32" H',
    material: 'Velvet Fabric & Solid Oak',
    stock_quantity: 8,
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 2,
    category_id: 1,
    name: 'Walnut & Glass Coffee Table',
    description: 'Elegant dual-tier oval coffee table with tempered glass top, lower storage shelf, and warm walnut veneer finish.',
    monthly_rate: 299.00,
    security_deposit: 600.00,
    dimensions: '44" W x 22" D x 18" H',
    material: 'Tempered Glass & Walnut Wood',
    stock_quantity: 12,
    image_url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80',
    featured: 0
  },
  {
    id: 3,
    category_id: 1,
    name: 'Boucle Swivel Accent Armchair',
    description: 'Curved contemporary statement lounge chair upholstered in cozy cream boucle with 360-degree smooth swivel base.',
    monthly_rate: 450.00,
    security_deposit: 900.00,
    dimensions: '32" W x 31" D x 30" H',
    material: 'Boucle Fabric & Brushed Brass',
    stock_quantity: 6,
    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 4,
    category_id: 2,
    name: 'Aura Queen Platform Bed with Headboard',
    description: 'Sturdy solid acacia wood queen platform bed with cushioned linen headboard and integrated acoustic slat support.',
    monthly_rate: 899.00,
    security_deposit: 1800.00,
    dimensions: '65" W x 84" L x 42" H',
    material: 'Acacia Hardwood & Linen Fabric',
    stock_quantity: 5,
    image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 5,
    category_id: 2,
    name: 'Minimalist 3-Door Sliding Wardrobe',
    description: 'Spacious engineered wood wardrobe with sliding mirror panel, built-in hanging rods, and 4 modular organizer shelves.',
    monthly_rate: 650.00,
    security_deposit: 1300.00,
    dimensions: '60" W x 24" D x 78" H',
    material: 'Engineered Wood & Glass Mirror',
    stock_quantity: 4,
    image_url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
    featured: 0
  },
  {
    id: 6,
    category_id: 2,
    name: 'Mid-Century Dual Drawer Nightstand',
    description: 'Compact bedside table crafted from sustainably sourced teak with soft-close ball bearing slide drawers and brass pulls.',
    monthly_rate: 199.00,
    security_deposit: 400.00,
    dimensions: '20" W x 18" D x 22" H',
    material: 'Teak Wood & Brass Hardware',
    stock_quantity: 10,
    image_url: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=800&q=80',
    featured: 0
  },
  {
    id: 7,
    category_id: 3,
    name: 'Artesian 4-Seater Dining Set',
    description: 'Natural oak dining table accompanied by four ergonomically curved dining chairs with padded faux leather seats.',
    monthly_rate: 749.00,
    security_deposit: 1500.00,
    dimensions: '48" L x 36" W x 30" H',
    material: 'Solid White Oak & Padded PU Leather',
    stock_quantity: 6,
    image_url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 8,
    category_id: 4,
    name: 'Pro-Ergo Mesh Executive Chair',
    description: 'High-back ergonomic office chair with breathable Korean mesh, dynamic lumbar support, 3D armrests, and synchro-tilt mechanism.',
    monthly_rate: 399.00,
    security_deposit: 800.00,
    dimensions: '26" W x 26" D x 46"-50" H',
    material: 'Reinforced Nylon, Mesh & Chrome Base',
    stock_quantity: 15,
    image_url: 'https://images.unsplash.com/photo-1580481077195-c328ad4f3879?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 9,
    category_id: 4,
    name: 'Electric Dual-Motor Standing Desk',
    description: 'Smart height-adjustable motorized desk with 4 memory presets, collision avoidance sensor, and scratch-resistant bamboo desktop.',
    monthly_rate: 699.00,
    security_deposit: 1400.00,
    dimensions: '55" W x 28" D x 28"-48" H',
    material: 'Solid Bamboo & Heavy Steel Frame',
    stock_quantity: 7,
    image_url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
    featured: 1
  },
  {
    id: 10,
    category_id: 5,
    name: 'Industrial 5-Tier Geometric Bookshelf',
    description: 'Open-concept shelving unit with matte black steel frame and vintage rustic wood grain shelves for books and decorative plants.',
    monthly_rate: 280.00,
    security_deposit: 550.00,
    dimensions: '35" W x 14" D x 70" H',
    material: 'Alloy Steel & Engineered Wood',
    stock_quantity: 9,
    image_url: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80',
    featured: 0
  }
];

function initSQLite() {
  const dbPath = path.join(__dirname, 'furniture_portal.sqlite');
  sqliteDb = new Database(dbPath);

  // Schema creation for SQLite
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS furniture_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      monthly_rate REAL NOT NULL,
      security_deposit REAL NOT NULL,
      dimensions TEXT,
      material TEXT,
      stock_quantity INTEGER DEFAULT 5,
      image_url TEXT,
      featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      tenure_months INTEGER NOT NULL DEFAULT 3,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      monthly_rent_total REAL NOT NULL,
      security_deposit_total REAL NOT NULL,
      discount_amount REAL DEFAULT 0.00,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      delivery_address TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rental_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER NOT NULL,
      furniture_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      monthly_rate REAL NOT NULL,
      security_deposit REAL NOT NULL,
      FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE,
      FOREIGN KEY (furniture_id) REFERENCES furniture_items(id) ON DELETE CASCADE
    );
  `);

  // Check default users
  const userCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck.count === 0) {
    const adminHash = bcrypt.hashSync('Admin@123', 10);
    const userHash = bcrypt.hashSync('User@123', 10);

    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('Rental Admin', 'admin@rentalfurniture.com', adminHash, 'admin', '+1-800-555-0199', 'Suite 400, HQ Furniture Plaza, Tech City');
    insertUser.run('John Doe', 'john@example.com', userHash, 'customer', '+1-555-0142', 'Apartment 4B, 128 Maplewood Ave, Metroville');
  }

  // Check categories
  const catCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCheck.count === 0) {
    const insertCat = sqliteDb.prepare(`
      INSERT INTO categories (id, name, slug, description, icon, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const c of initialCategories) {
      insertCat.run(c.id, c.name, c.slug, c.description, c.icon, c.image_url);
    }
  }

  // Check furniture
  const furnCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM furniture_items').get();
  if (furnCheck.count === 0) {
    const insertFurn = sqliteDb.prepare(`
      INSERT INTO furniture_items (id, category_id, name, description, monthly_rate, security_deposit, dimensions, material, stock_quantity, image_url, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of initialFurniture) {
      insertFurn.run(f.id, f.category_id, f.name, f.description, f.monthly_rate, f.security_deposit, f.dimensions, f.material, f.stock_quantity, f.image_url, f.featured);
    }
  }

  // Check sample rental
  const rentCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM rentals').get();
  if (rentCheck.count === 0) {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const insertRental = sqliteDb.prepare(`
      INSERT INTO rentals (rental_code, user_id, tenure_months, start_date, end_date, monthly_rent_total, security_deposit_total, discount_amount, total_amount, status, delivery_address, notes)
      VALUES (?, ?, 3, ?, ?, 1098.00, 2100.00, 164.70, 5229.30, 'active', 'Apartment 4B, 128 Maplewood Ave, Metroville', 'Leave with front desk concierge.')
    `);
    const rInfo = insertRental.run('RNT-842915', 2, startDate, endDate);
    const insertItem = sqliteDb.prepare(`
      INSERT INTO rental_items (rental_id, furniture_id, quantity, monthly_rate, security_deposit)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertItem.run(rInfo.lastInsertRowid, 1, 1, 799.00, 1500.00);
    insertItem.run(rInfo.lastInsertRowid, 2, 1, 299.00, 600.00);
  }
}

async function initDB() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'furniture_rental_db';

  try {
    const testPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const conn = await testPool.getConnection();
    await conn.ping();
    conn.release();

    pool = testPool;
    dbMode = 'mysql';
    console.log(`[DB] Successfully connected to MySQL database: '${database}' on ${host}:${port}`);
    return;
  } catch (err) {
    console.warn(`[DB] MySQL connection attempt failed (${err.message}).`);
    console.warn(`[DB] Switching to integrated SQLite storage engine with pre-seeded data.`);
    console.info(`[DB] (To use MySQL, set DB_PASSWORD in .env and run 'npm run db:setup')`);
    initSQLite();
    dbMode = 'sqlite';
    console.log(`[DB] SQLite initialized successfully.`);
  }
}

/**
 * Universal query helper that returns [rows, fields] format compatible with mysql2
 */
async function query(sql, params = []) {
  if (dbMode === 'uninitialized') {
    await initDB();
  }

  if (dbMode === 'mysql') {
    return await pool.query(sql, params);
  } else {
    // SQLite mode compatibility
    // Handle parameterized query (?)
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA)/i.test(trimmed);

    try {
      if (isSelect) {
        const stmt = sqliteDb.prepare(sql);
        const rows = stmt.all(...params);
        return [rows, []];
      } else {
        const stmt = sqliteDb.prepare(sql);
        const info = stmt.run(...params);
        const resultHeader = {
          insertId: info.lastInsertRowid,
          affectedRows: info.changes
        };
        return [resultHeader, []];
      }
    } catch (sqliteErr) {
      console.error('[DB Query Error]', sqliteErr.message, 'SQL:', sql);
      throw sqliteErr;
    }
  }
}

function getDbMode() {
  return dbMode;
}

module.exports = {
  initDB,
  query,
  getDbMode
};
