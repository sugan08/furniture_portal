const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const categoriesData = [
  {
    name: 'Living Room',
    slug: 'living-room',
    description: 'Plush sofas, coffee tables, accent chairs, and entertainment centers.',
    icon: 'fa-couch',
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Bedroom',
    slug: 'bedroom',
    description: 'Comfortable beds, wardrobes, side tables, and orthopedic mattresses.',
    icon: 'fa-bed',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Dining Room',
    slug: 'dining-room',
    description: 'Modern dining sets, wooden tables, and comfortable dining chairs.',
    icon: 'fa-utensils',
    image_url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Home Office',
    slug: 'home-office',
    description: 'Ergonomic chairs, height-adjustable desks, and workstation setups.',
    icon: 'fa-briefcase',
    image_url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Storage & Decor',
    slug: 'storage-decor',
    description: 'Bookshelves, shoe racks, floor lamps, and multi-utility storage units.',
    icon: 'fa-boxes-stacked',
    image_url: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80'
  }
];

const furnitureData = [
  {
    category_slug: 'living-room',
    name: 'Nordic Velvet 3-Seater Sofa',
    description: 'Scandinavian minimalist sofa wrapped in premium stain-resistant velvet fabric with tapered solid oak legs and high-density foam cushions.',
    monthly_rate: 799.00,
    security_deposit: 1500.00,
    dimensions: '82" W x 34" D x 32" H',
    material: 'Velvet Fabric & Solid Oak',
    stock_quantity: 8,
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'living-room',
    name: 'Walnut & Glass Coffee Table',
    description: 'Elegant dual-tier oval coffee table with tempered glass top, lower storage shelf, and warm walnut veneer finish.',
    monthly_rate: 299.00,
    security_deposit: 600.00,
    dimensions: '44" W x 22" D x 18" H',
    material: 'Tempered Glass & Walnut Wood',
    stock_quantity: 12,
    image_url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80',
    featured: false
  },
  {
    category_slug: 'living-room',
    name: 'Boucle Swivel Accent Armchair',
    description: 'Curved contemporary statement lounge chair upholstered in cozy cream boucle with 360-degree smooth swivel base.',
    monthly_rate: 450.00,
    security_deposit: 900.00,
    dimensions: '32" W x 31" D x 30" H',
    material: 'Boucle Fabric & Brushed Brass',
    stock_quantity: 6,
    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'bedroom',
    name: 'Aura Queen Platform Bed with Headboard',
    description: 'Sturdy solid acacia wood queen platform bed with cushioned linen headboard and integrated acoustic slat support.',
    monthly_rate: 899.00,
    security_deposit: 1800.00,
    dimensions: '65" W x 84" L x 42" H',
    material: 'Acacia Hardwood & Linen Fabric',
    stock_quantity: 5,
    image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'bedroom',
    name: 'Minimalist 3-Door Sliding Wardrobe',
    description: 'Spacious engineered wood wardrobe with sliding mirror panel, built-in hanging rods, and 4 modular organizer shelves.',
    monthly_rate: 650.00,
    security_deposit: 1300.00,
    dimensions: '60" W x 24" D x 78" H',
    material: 'Engineered Wood & Glass Mirror',
    stock_quantity: 4,
    image_url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
    featured: false
  },
  {
    category_slug: 'bedroom',
    name: 'Mid-Century Dual Drawer Nightstand',
    description: 'Compact bedside table crafted from sustainably sourced teak with soft-close ball bearing slide drawers and brass pulls.',
    monthly_rate: 199.00,
    security_deposit: 400.00,
    dimensions: '20" W x 18" D x 22" H',
    material: 'Teak Wood & Brass Hardware',
    stock_quantity: 10,
    image_url: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=800&q=80',
    featured: false
  },
  {
    category_slug: 'dining-room',
    name: 'Artesian 4-Seater Dining Set',
    description: 'Natural oak dining table accompanied by four ergonomically curved dining chairs with padded faux leather seats.',
    monthly_rate: 749.00,
    security_deposit: 1500.00,
    dimensions: '48" L x 36" W x 30" H',
    material: 'Solid White Oak & Padded PU Leather',
    stock_quantity: 6,
    image_url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'home-office',
    name: 'Pro-Ergo Mesh Executive Chair',
    description: 'High-back ergonomic office chair with breathable Korean mesh, dynamic lumbar support, 3D armrests, and synchro-tilt mechanism.',
    monthly_rate: 399.00,
    security_deposit: 800.00,
    dimensions: '26" W x 26" D x 46"-50" H',
    material: 'Reinforced Nylon, Mesh & Chrome Base',
    stock_quantity: 15,
    image_url: 'https://images.unsplash.com/photo-1580481077195-c328ad4f3879?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'home-office',
    name: 'Electric Dual-Motor Standing Desk',
    description: 'Smart height-adjustable motorized desk with 4 memory presets, collision avoidance sensor, and scratch-resistant bamboo desktop.',
    monthly_rate: 699.00,
    security_deposit: 1400.00,
    dimensions: '55" W x 28" D x 28"-48" H',
    material: 'Solid Bamboo & Heavy Steel Frame',
    stock_quantity: 7,
    image_url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
    featured: true
  },
  {
    category_slug: 'storage-decor',
    name: 'Industrial 5-Tier Geometric Bookshelf',
    description: 'Open-concept shelving unit with matte black steel frame and vintage rustic wood grain shelves for books and decorative plants.',
    monthly_rate: 280.00,
    security_deposit: 550.00,
    dimensions: '35" W x 14" D x 70" H',
    material: 'Alloy Steel & Engineered Wood',
    stock_quantity: 9,
    image_url: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80',
    featured: false
  }
];

async function tryConnect(config) {
  try {
    const connection = await mysql.createConnection(config);
    return connection;
  } catch (err) {
    return null;
  }
}

async function setupDatabase() {
  console.log('=== Initializing Furniture Rental Portal Database ===');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const envPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';

  // Password attempts to test common local setups
  const candidatePasswords = [envPassword, 'root', '', 'admin', 'password', '123456', 'MySQL@123', 'root123'];
  // Deduplicate
  const passwordsToTry = [...new Set(candidatePasswords)];

  let connection = null;
  let successfulPassword = null;

  for (const pwd of passwordsToTry) {
    console.log(`Testing MySQL connection with user '${user}'...`);
    connection = await tryConnect({ host, port, user, password: pwd });
    if (connection) {
      successfulPassword = pwd;
      console.log(`Successfully connected to MySQL with password: "${pwd === '' ? '(empty)' : pwd}"`);
      break;
    }
  }

  if (!connection) {
    console.error('\nCould not connect to MySQL server with tested passwords.');
    console.error('Please verify MySQL service is running and update DB_PASSWORD in .env if you have set a custom password.');
    console.error('Connection config:', { host, port, user });
    return false;
  }

  try {
    // If successful password differed from .env, update .env
    if (successfulPassword !== envPassword) {
      console.log(`Updating .env with working DB_PASSWORD...`);
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (envContent.includes('DB_PASSWORD=')) {
        envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${successfulPassword}`);
      } else {
        envContent += `\nDB_PASSWORD=${successfulPassword}`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }

    const dbName = process.env.DB_NAME || 'furniture_rental_db';
    console.log(`Creating database '${dbName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);

    console.log('Executing schema definitions...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split and execute statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('use') && !s.toLowerCase().startsWith('create database'));

    for (const stmt of statements) {
      await connection.query(stmt);
    }
    console.log('Database tables verified / created.');

    // Seed default Users
    console.log('Checking default users...');
    const [existingUsers] = await connection.query('SELECT email FROM users WHERE email IN (?, ?)', [
      'admin@rentalfurniture.com',
      'john@example.com'
    ]);

    const adminHash = await bcrypt.hash('Admin@123', 10);
    const customerHash = await bcrypt.hash('User@123', 10);

    if (existingUsers.length === 0) {
      await connection.query(`
        INSERT INTO users (name, email, password_hash, role, phone, address) VALUES
        ('Rental Admin', 'admin@rentalfurniture.com', ?, 'admin', '+1-800-555-0199', 'Suite 400, HQ Furniture Plaza, Tech City'),
        ('John Doe', 'john@example.com', ?, 'customer', '+1-555-0142', 'Apartment 4B, 128 Maplewood Ave, Metroville')
      `, [adminHash, customerHash]);
      console.log('Default Admin & Customer accounts seeded.');
    } else {
      console.log('Default users already present.');
    }

    // Seed Categories
    console.log('Checking categories...');
    for (const cat of categoriesData) {
      const [existing] = await connection.query('SELECT id FROM categories WHERE slug = ?', [cat.slug]);
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO categories (name, slug, description, icon, image_url) VALUES (?, ?, ?, ?, ?)',
          [cat.name, cat.slug, cat.description, cat.icon, cat.image_url]
        );
      }
    }
    console.log('Categories seeded.');

    // Fetch category map
    const [cats] = await connection.query('SELECT id, slug FROM categories');
    const catMap = {};
    cats.forEach(c => { catMap[c.slug] = c.id; });

    // Seed Furniture Items
    console.log('Checking furniture items...');
    for (const item of furnitureData) {
      const categoryId = catMap[item.category_slug];
      if (!categoryId) continue;

      const [existing] = await connection.query('SELECT id FROM furniture_items WHERE name = ?', [item.name]);
      if (existing.length === 0) {
        await connection.query(`
          INSERT INTO furniture_items 
          (category_id, name, description, monthly_rate, security_deposit, dimensions, material, stock_quantity, image_url, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          categoryId,
          item.name,
          item.description,
          item.monthly_rate,
          item.security_deposit,
          item.dimensions,
          item.material,
          item.stock_quantity,
          item.image_url,
          item.featured
        ]);
      }
    }
    console.log('Furniture catalog items seeded.');

    // Seed Sample Rental Order if none exist
    const [rentalCount] = await connection.query('SELECT COUNT(*) as count FROM rentals');
    if (rentalCount[0].count === 0) {
      const [userRows] = await connection.query('SELECT id FROM users WHERE email = ?', ['john@example.com']);
      const [furnitureRows] = await connection.query('SELECT id, monthly_rate, security_deposit FROM furniture_items LIMIT 2');
      
      if (userRows.length > 0 && furnitureRows.length > 0) {
        const userId = userRows[0].id;
        const rentalCode = 'RNT-' + Math.floor(100000 + Math.random() * 900000);
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        let monthlyTotal = 0;
        let depositTotal = 0;
        furnitureRows.forEach(f => {
          monthlyTotal += Number(f.monthly_rate);
          depositTotal += Number(f.security_deposit);
        });

        // 3 month tenure total = 3 * monthlyTotal + depositTotal - discount
        const discount = Math.round(monthlyTotal * 3 * 0.05); // 5% discount
        const grandTotal = (monthlyTotal * 3) + depositTotal - discount;

        const [rentalResult] = await connection.query(`
          INSERT INTO rentals 
          (rental_code, user_id, tenure_months, start_date, end_date, monthly_rent_total, security_deposit_total, discount_amount, total_amount, status, delivery_address, notes)
          VALUES (?, ?, 3, ?, ?, ?, ?, ?, ?, 'active', 'Apartment 4B, 128 Maplewood Ave, Metroville', 'Leave with front desk concierge.')
        `, [rentalCode, userId, startDate, endDate, monthlyTotal, depositTotal, discount, grandTotal]);

        const rentalId = rentalResult.insertId;
        for (const f of furnitureRows) {
          await connection.query(`
            INSERT INTO rental_items (rental_id, furniture_id, quantity, monthly_rate, security_deposit)
            VALUES (?, ?, 1, ?, ?)
          `, [rentalId, f.id, f.monthly_rate, f.security_deposit]);
        }
        console.log(`Sample active rental created with code ${rentalCode}.`);
      }
    }

    console.log('\nDatabase setup successfully finished!');
    return true;
  } catch (err) {
    console.error('Error setting up database:', err);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  setupDatabase().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = setupDatabase;
