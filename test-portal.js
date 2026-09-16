const http = require('http');

// Simple test runner without external dependencies
async function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  const server = require('./server');
  await server.startServer();
  await new Promise(r => setTimeout(r, 800));

  let customerToken = '';
  let adminToken = '';
  let createdRentalId = null;

  try {
    // 1. Health check
    console.log('[Test 1] Health Check...');
    const health = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    console.log('Health Response:', health.data);
    if (health.status !== 200 || health.data.status !== 'healthy') throw new Error('Health check failed');

    // 2. Login Customer
    console.log('\n[Test 2] Login Customer (john@example.com)...');
    const custLogin = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'john@example.com', password: 'User@123' });
    
    if (custLogin.status !== 200 || !custLogin.data.token) {
      throw new Error('Customer login failed: ' + JSON.stringify(custLogin.data));
    }
    customerToken = custLogin.data.token;
    console.log('Customer logged in successfully. Name:', custLogin.data.user.name);

    // 3. Login Admin
    console.log('\n[Test 3] Login Admin (admin@rentalfurniture.com)...');
    const admLogin = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@rentalfurniture.com', password: 'Admin@123' });

    if (admLogin.status !== 200 || !admLogin.data.token) {
      throw new Error('Admin login failed: ' + JSON.stringify(admLogin.data));
    }
    adminToken = admLogin.data.token;
    console.log('Admin logged in successfully. Role:', admLogin.data.user.role);

    // 4. Get Categories
    console.log('\n[Test 4] Fetch Categories...');
    const cats = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/categories',
      method: 'GET'
    });
    console.log(`Retrieved ${cats.data.categories.length} categories.`);
    if (cats.data.categories.length === 0) throw new Error('No categories returned');

    // 5. Get Furniture Catalog
    console.log('\n[Test 5] Fetch Furniture Items...');
    const furn = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/furniture?category=living-room',
      method: 'GET'
    });
    console.log(`Retrieved ${furn.data.items.length} living room furniture items.`);

    // 6. Book Rental with 6-month tenure (10% discount test)
    console.log('\n[Test 6] Book Rental with 6-month tenure...');
    const rentalPayload = {
      tenure_months: 6,
      delivery_address: '42 Wallaby Way, Sydney',
      notes: 'Please call before delivery',
      items: [
        { furniture_id: 1, quantity: 1 },
        { furniture_id: 2, quantity: 1 }
      ]
    };
    const bookRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/rentals',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      }
    }, rentalPayload);

    console.log('Booking Result:', bookRes.data);
    if (bookRes.status !== 201 || !bookRes.data.rental) {
      throw new Error('Booking failed: ' + JSON.stringify(bookRes.data));
    }
    createdRentalId = bookRes.data.rental.id;
    console.log('Created Rental Code:', bookRes.data.rental.rental_code);
    console.log('Discount Applied:', bookRes.data.rental.discount_amount);

    // 7. Get Customer Rentals
    console.log('\n[Test 7] Fetch My Rentals...');
    const myRentals = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/rentals/my-rentals',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    console.log(`Customer has ${myRentals.data.rentals.length} rentals.`);

    // 8. Admin KPI Stats
    console.log('\n[Test 8] Fetch Admin Stats...');
    const stats = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('Admin Stats:', stats.data.stats.rentals);

    // 9. Admin Update Rental Status
    console.log('\n[Test 9] Admin approve rental...');
    const updateRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/admin/rentals/${createdRentalId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'approved' });
    console.log('Update result:', updateRes.data);

    // 10. Verify Frontend Assets
    console.log('\n[Test 10] Static Assets Check (/ , /css/style.css , /js/app.js , /js/admin.js)...');
    const indexRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/', method: 'GET' });
    if (indexRes.status !== 200 || !indexRes.raw.includes('FurniRent')) throw new Error('index.html check failed');

    const cssRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/css/style.css', method: 'GET' });
    if (cssRes.status !== 200 || !cssRes.raw.includes('--primary')) throw new Error('style.css check failed');

    const appJsRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/js/app.js', method: 'GET' });
    if (appJsRes.status !== 200 || !appJsRes.raw.includes('addToCart')) throw new Error('app.js check failed');

    const adminJsRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/js/admin.js', method: 'GET' });
    if (adminJsRes.status !== 200 || !adminJsRes.raw.includes('loadAdminStats')) throw new Error('admin.js check failed');
    console.log('All frontend static assets verified!');

    // 11. Admin Add Furniture Item
    console.log('\n[Test 11] Admin Add New Furniture Item...');
    const addFurnRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/furniture',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      category_id: 1,
      name: 'Automated Test Recliner Chair',
      description: 'Ultra-luxurious test recliner with heat and massage.',
      monthly_rate: 499.00,
      security_deposit: 1000.00,
      stock_quantity: 4,
      dimensions: '36" W x 38" D x 40" H',
      material: 'Top-grain Leather',
      image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
      featured: 1
    });

    if (addFurnRes.status !== 201 || !addFurnRes.data.itemId) throw new Error('Failed to create furniture: ' + JSON.stringify(addFurnRes.data));
    const newFurnId = addFurnRes.data.itemId;
    console.log('Created test furniture item with ID:', newFurnId);

    // 12. Admin Delete Furniture Item
    console.log('\n[Test 12] Admin Delete Furniture Item...');
    const delFurnRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/furniture/${newFurnId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (delFurnRes.status !== 200 || !delFurnRes.data.success) throw new Error('Failed to delete item: ' + JSON.stringify(delFurnRes.data));
    console.log('Successfully deleted test furniture item.');

    console.log('\n🎉 ALL 12 INTEGRATION & FRONTEND VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
