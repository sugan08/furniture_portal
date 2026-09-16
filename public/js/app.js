/**
 * Online Furniture Rental Portal - Main Application Logic
 */

// Global App State
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  cartTenure: parseInt(localStorage.getItem('cartTenure') || '3', 10),
  categories: [],
  furniture: [],
  selectedCategory: 'all',
  searchQuery: '',
  sortBy: 'newest',
  currentQuickViewItem: null
};

// API Base URL
const API_BASE = '/api';

/* ============================================================
   INIT & DOM READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  fetchCategories();
  fetchFurniture();
  updateCartBadge();
  initEventListeners();
  initHeroCalculator();
});

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function initEventListeners() {
  // Search bar in navbar & hero
  const heroSearchInput = document.getElementById('heroSearchInput');
  if (heroSearchInput) {
    heroSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = heroSearchInput.value;
        const catalogSearch = document.getElementById('catalogSearchInput');
        if (catalogSearch) catalogSearch.value = heroSearchInput.value;
        document.getElementById('catalog-section').scrollIntoView({ behavior: 'smooth' });
        fetchFurniture();
      }
    });
  }

  const catalogSearchInput = document.getElementById('catalogSearchInput');
  if (catalogSearchInput) {
    let debounceTimer;
    catalogSearchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = catalogSearchInput.value;
        fetchFurniture();
      }, 300);
    });
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      fetchFurniture();
    });
  }

  // Auth form submissions
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  // Checkout form submission
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });
}

/* ============================================================
   AUTH HANDLING
   ============================================================ */
function initAuthUI() {
  const authNavGuest = document.getElementById('authNavGuest');
  const authNavUser = document.getElementById('authNavUser');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const adminNavBtn = document.getElementById('adminNavBtn');
  const myRentalsNavBtn = document.getElementById('myRentalsNavBtn');

  if (state.token && state.user) {
    if (authNavGuest) authNavGuest.style.display = 'none';
    if (authNavUser) authNavUser.style.display = 'flex';
    if (userNameDisplay) userNameDisplay.textContent = state.user.name.split(' ')[0];
    if (myRentalsNavBtn) myRentalsNavBtn.style.display = 'inline-flex';

    if (adminNavBtn) {
      adminNavBtn.style.display = state.user.role === 'admin' ? 'inline-flex' : 'none';
    }
  } else {
    if (authNavGuest) authNavGuest.style.display = 'flex';
    if (authNavUser) authNavUser.style.display = 'none';
    if (adminNavBtn) adminNavBtn.style.display = 'none';
    if (myRentalsNavBtn) myRentalsNavBtn.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      setSession(data.token, data.user);
      closeAllModals();
      showToast(`Welcome back, ${data.user.name}!`, 'success');
    } else {
      showToast(data.message || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during login.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const phone = document.getElementById('regPhone').value.trim();
  const address = document.getElementById('regAddress').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone, address })
    });
    const data = await res.json();

    if (data.success) {
      setSession(data.token, data.user);
      closeAllModals();
      showToast('Account registered successfully! Welcome aboard.', 'success');
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during registration.', 'error');
  }
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  initAuthUI();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  initAuthUI();
  showToast('Logged out successfully.', 'info');
}

// Quick 1-Click Login for reviewers
async function loginAsDemo(role) {
  const credentials = role === 'admin' 
    ? { email: 'admin@rentalfurniture.com', password: 'Admin@123' }
    : { email: 'john@example.com', password: 'User@123' };

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (data.success) {
      setSession(data.token, data.user);
      closeAllModals();
      showToast(`Logged in as ${data.user.name} (${data.user.role})!`, 'success');
      if (role === 'admin') {
        setTimeout(openAdminModal, 400);
      }
    }
  } catch (err) {
    showToast('Could not sign in with demo account.', 'error');
  }
}

/* ============================================================
   CATEGORIES & FURNITURE API
   ============================================================ */
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const data = await res.json();
    if (data.success) {
      state.categories = data.categories;
      renderCategoryTabs();
    }
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabsContainer');
  if (!container) return;

  let html = `
    <button class="category-tab ${state.selectedCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
      <i class="fa-solid fa-border-all"></i> All Collections
    </button>
  `;

  state.categories.forEach(cat => {
    const isActive = state.selectedCategory === cat.slug;
    html += `
      <button class="category-tab ${isActive ? 'active' : ''}" onclick="selectCategory('${cat.slug}')">
        <i class="fa-solid ${cat.icon || 'fa-couch'}"></i> ${cat.name} (${cat.item_count || 0})
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(slug) {
  state.selectedCategory = slug;
  renderCategoryTabs();
  fetchFurniture();
}

async function fetchFurniture() {
  const grid = document.getElementById('furnitureGrid');
  const countBadge = document.getElementById('itemsCountBadge');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; color: var(--primary);"></i>
      <p>Loading curated furniture catalog...</p>
    </div>
  `;

  let url = `${API_BASE}/furniture?sort=${state.sortBy}`;
  if (state.selectedCategory !== 'all') {
    url += `&category=${encodeURIComponent(state.selectedCategory)}`;
  }
  if (state.searchQuery.trim() !== '') {
    url += `&search=${encodeURIComponent(state.searchQuery.trim())}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      state.furniture = data.items;
      if (countBadge) countBadge.textContent = `${data.count} items found`;
      renderFurnitureGrid(data.items);
    }
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--danger);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px;"></i>
        <p>Could not load furniture catalog. Please ensure server is running.</p>
      </div>
    `;
  }
}

function renderFurnitureGrid(items) {
  const grid = document.getElementById('furnitureGrid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
        <i class="fa-solid fa-couch" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 16px;"></i>
        <h3 style="font-weight: 700; color: var(--dark); margin-bottom: 8px;">No furniture found</h3>
        <p style="color: var(--muted); margin-bottom: 20px;">Try changing your search terms or category filter.</p>
        <button class="btn-outline" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="furniture-card">
      <div class="card-img-wrap">
        <img src="${item.image_url}" alt="${escapeHtml(item.name)}" class="card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'">
        <div class="card-badge-top">
          <span class="badge badge-category">${escapeHtml(item.category_name)}</span>
          ${item.featured ? '<span class="badge badge-featured"><i class="fa-solid fa-star"></i> Featured</span>' : ''}
        </div>
        <div class="badge-stock">
          <i class="fa-solid fa-circle" style="font-size: 8px; color: ${item.stock_quantity > 2 ? 'var(--success)' : 'var(--warning)'};"></i>
          ${item.stock_quantity > 0 ? `${item.stock_quantity} in stock` : '<span style="color: var(--danger);">Out of stock</span>'}
        </div>
      </div>
      
      <div class="card-body">
        <h4 class="card-title">${escapeHtml(item.name)}</h4>
        <div class="card-meta">
          <span><i class="fa-solid fa-ruler-combined"></i> ${escapeHtml(item.dimensions || 'Standard')}</span>
          <span><i class="fa-solid fa-layer-group"></i> ${escapeHtml(item.material || 'Solid Wood')}</span>
        </div>
        <p class="card-desc">${escapeHtml(item.description)}</p>

        <div class="card-pricing">
          <div class="price-rent">
            <span class="price-rent-label">Monthly Rent</span>
            <div class="price-rent-val">₹${formatCurrency(item.monthly_rate)}<span>/mo</span></div>
          </div>
          <div class="price-deposit">
            <span class="price-deposit-label">Refundable Deposit</span>
            <div class="price-deposit-val">₹${formatCurrency(item.security_deposit)}</div>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-card-view" onclick="openQuickView(${item.id})">
            <i class="fa-regular fa-eye"></i> Quick View
          </button>
          <button class="btn-card-add" onclick="addToCart(${item.id})" ${item.stock_quantity <= 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            <i class="fa-solid fa-cart-plus"></i> Rent Now
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function resetFilters() {
  state.selectedCategory = 'all';
  state.searchQuery = '';
  const input = document.getElementById('catalogSearchInput');
  if (input) input.value = '';
  renderCategoryTabs();
  fetchFurniture();
}

/* ============================================================
   QUICK VIEW MODAL & TENURE CALCULATOR
   ============================================================ */
async function openQuickView(id) {
  try {
    const res = await fetch(`${API_BASE}/furniture/${id}`);
    const data = await res.json();
    if (!data.success || !data.item) {
      showToast('Could not load item details.', 'error');
      return;
    }

    const item = data.item;
    state.currentQuickViewItem = item;

    document.getElementById('qvImage').src = item.image_url;
    document.getElementById('qvCategory').textContent = item.category_name;
    document.getElementById('qvTitle').textContent = item.name;
    document.getElementById('qvDesc').textContent = item.description;
    document.getElementById('qvDimensions').textContent = item.dimensions || 'Standard';
    document.getElementById('qvMaterial').textContent = item.material || 'Mixed Materials';
    document.getElementById('qvStock').textContent = `${item.stock_quantity} available`;
    document.getElementById('qvMonthlyRate').textContent = `₹${formatCurrency(item.monthly_rate)}/mo`;
    document.getElementById('qvDeposit').textContent = `₹${formatCurrency(item.security_deposit)}`;

    // Set default preview tenure to 6 months
    updateQuickViewCalc(6);

    openModal('quickViewModal');
  } catch (err) {
    showToast('Failed to load item.', 'error');
  }
}

function updateQuickViewCalc(months) {
  if (!state.currentQuickViewItem) return;
  const item = state.currentQuickViewItem;

  document.querySelectorAll('#qvTenureGroup .tenure-pill').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.months, 10) === months);
  });

  const discountRate = months >= 12 ? 0.15 : (months >= 6 ? 0.10 : (months >= 3 ? 0.05 : 0));
  const grossRent = item.monthly_rate * months;
  const discount = Math.round(grossRent * discountRate);
  const netRent = grossRent - discount;
  const totalUpfront = Math.round(netRent + item.security_deposit);

  document.getElementById('qvCalcGross').textContent = `₹${formatCurrency(grossRent)}`;
  document.getElementById('qvCalcDiscount').textContent = `-₹${formatCurrency(discount)} (${Math.round(discountRate * 100)}% off)`;
  document.getElementById('qvCalcDeposit').textContent = `₹${formatCurrency(item.security_deposit)}`;
  document.getElementById('qvCalcTotal').textContent = `₹${formatCurrency(totalUpfront)}`;
}

function addCurrentQuickViewToCart() {
  if (!state.currentQuickViewItem) return;
  addToCart(state.currentQuickViewItem.id);
  closeAllModals();
}

/* ============================================================
   HERO CALCULATOR DEMO
   ============================================================ */
function initHeroCalculator() {
  const defaultRate = 799;
  const defaultDeposit = 1500;
  window.setHeroTenure = function(months) {
    document.querySelectorAll('#heroTenureGroup .tenure-pill').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.months, 10) === months);
    });

    const discountRate = months >= 12 ? 0.15 : (months >= 6 ? 0.10 : (months >= 3 ? 0.05 : 0));
    const grossRent = defaultRate * months;
    const discount = Math.round(grossRent * discountRate);
    const netRent = grossRent - discount;
    const total = netRent + defaultDeposit;

    const rateEl = document.getElementById('heroCalcRate');
    const discEl = document.getElementById('heroCalcDiscount');
    const totalEl = document.getElementById('heroCalcTotal');

    if (rateEl) rateEl.textContent = `₹${formatCurrency(defaultRate)} × ${months} mo = ₹${formatCurrency(grossRent)}`;
    if (discEl) discEl.textContent = `-₹${formatCurrency(discount)} (${Math.round(discountRate * 100)}% OFF)`;
    if (totalEl) totalEl.textContent = `₹${formatCurrency(total)}`;
  };
}

/* ============================================================
   CART MANAGEMENT & FLEXIBLE TENURE
   ============================================================ */
function addToCart(furnitureId) {
  const item = state.furniture.find(f => f.id === furnitureId) || state.currentQuickViewItem;
  if (!item) return;

  const existing = state.cart.find(c => c.id === furnitureId);
  if (existing) {
    if (existing.quantity >= item.stock_quantity) {
      showToast(`Cannot add more. Only ${item.stock_quantity} available in stock.`, 'warning');
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: item.id,
      name: item.name,
      monthly_rate: parseFloat(item.monthly_rate),
      security_deposit: parseFloat(item.security_deposit),
      image_url: item.image_url,
      stock_quantity: item.stock_quantity,
      quantity: 1
    });
  }

  saveCart();
  updateCartBadge();
  showToast(`Added "${item.name}" to rental cart!`, 'success');
}

function updateCartQty(furnitureId, delta) {
  const existing = state.cart.find(c => c.id === furnitureId);
  if (!existing) return;

  const newQty = existing.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(furnitureId);
    return;
  }

  if (newQty > existing.stock_quantity) {
    showToast(`Maximum stock limit (${existing.stock_quantity}) reached.`, 'warning');
    return;
  }

  existing.quantity = newQty;
  saveCart();
  renderCartDrawer();
  updateCartBadge();
}

function removeFromCart(furnitureId) {
  state.cart = state.cart.filter(c => c.id !== furnitureId);
  saveCart();
  renderCartDrawer();
  updateCartBadge();
  showToast('Item removed from cart.', 'info');
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  localStorage.setItem('cartTenure', state.cartTenure.toString());
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function setCartTenure(months) {
  state.cartTenure = months;
  saveCart();
  renderCartDrawer();
}

function renderCartDrawer() {
  const itemsContainer = document.getElementById('cartItemsList');
  const emptyView = document.getElementById('cartEmptyView');
  const cartFooter = document.getElementById('cartFooter');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');

  if (!itemsContainer) return;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = '';
    if (emptyView) emptyView.style.display = 'block';
    if (cartFooter) cartFooter.style.display = 'none';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (emptyView) emptyView.style.display = 'none';
  if (cartFooter) cartFooter.style.display = 'block';
  if (checkoutBtn) checkoutBtn.disabled = false;

  // Render items
  itemsContainer.innerHTML = state.cart.map(item => `
    <div class="cart-item-row">
      <img src="${item.image_url}" alt="${escapeHtml(item.name)}" class="cart-item-thumb">
      <div class="cart-item-details">
        <h5 class="cart-item-title">${escapeHtml(item.name)}</h5>
        <div class="cart-item-rate">₹${formatCurrency(item.monthly_rate)} / month</div>
        <div class="cart-item-deposit">Deposit: ₹${formatCurrency(item.security_deposit)} (Refundable)</div>
      </div>
      <div class="cart-qty-ctrl">
        <button class="cart-qty-btn" onclick="updateCartQty(${item.id}, -1)">-</button>
        <span class="cart-qty-num">${item.quantity}</span>
        <button class="cart-qty-btn" onclick="updateCartQty(${item.id}, 1)">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  // Update Tenure radio selection buttons
  document.querySelectorAll('#cartTenureGroup .tenure-radio-card').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.months, 10) === state.cartTenure);
  });

  // Calculate totals
  const monthlySubtotal = state.cart.reduce((sum, item) => sum + (item.monthly_rate * item.quantity), 0);
  const depositTotal = state.cart.reduce((sum, item) => sum + (item.security_deposit * item.quantity), 0);
  const tenure = state.cartTenure;

  const discountRate = tenure >= 12 ? 0.15 : (tenure >= 6 ? 0.10 : (tenure >= 3 ? 0.05 : 0));
  const grossRent = monthlySubtotal * tenure;
  const discountAmount = Math.round(grossRent * discountRate);
  const netRent = grossRent - discountAmount;
  const grandTotal = netRent + depositTotal;

  document.getElementById('cartMonthlySubtotal').textContent = `₹${formatCurrency(monthlySubtotal)} / mo`;
  document.getElementById('cartGrossRent').textContent = `₹${formatCurrency(grossRent)} (${tenure} mo)`;
  document.getElementById('cartDiscountAmount').textContent = `-₹${formatCurrency(discountAmount)} (${Math.round(discountRate * 100)}%)`;
  document.getElementById('cartDepositTotal').textContent = `₹${formatCurrency(depositTotal)}`;
  document.getElementById('cartGrandTotal').textContent = `₹${formatCurrency(grandTotal)}`;
}

function openCartModal() {
  renderCartDrawer();
  openModal('cartModal');
}

/* ============================================================
   CHECKOUT FLOW
   ============================================================ */
function startCheckout() {
  if (state.cart.length === 0) {
    showToast('Your cart is empty.', 'warning');
    return;
  }

  if (!state.token || !state.user) {
    closeAllModals();
    openModal('authModal');
    showToast('Please sign in to complete your rental booking.', 'info');
    return;
  }

  // Pre-fill user profile info if available
  const nameField = document.getElementById('coName');
  const phoneField = document.getElementById('coPhone');
  const addrField = document.getElementById('coAddress');

  if (nameField && state.user.name) nameField.value = state.user.name;
  if (phoneField && state.user.phone) phoneField.value = state.user.phone;
  if (addrField && state.user.address) addrField.value = state.user.address;

  // Set default preferred delivery date: 3 days from now
  const dateField = document.getElementById('coDeliveryDate');
  if (dateField) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    dateField.value = d.toISOString().split('T')[0];
  }

  // Update checkout order summary
  const monthlySubtotal = state.cart.reduce((sum, item) => sum + (item.monthly_rate * item.quantity), 0);
  const depositTotal = state.cart.reduce((sum, item) => sum + (item.security_deposit * item.quantity), 0);
  const tenure = state.cartTenure;

  const discountRate = tenure >= 12 ? 0.15 : (tenure >= 6 ? 0.10 : (tenure >= 3 ? 0.05 : 0));
  const grossRent = monthlySubtotal * tenure;
  const discountAmount = Math.round(grossRent * discountRate);
  const grandTotal = (grossRent - discountAmount) + depositTotal;

  document.getElementById('coSummaryItems').textContent = `${state.cart.reduce((s, i) => s + i.quantity, 0)} Items (${tenure} Months Tenure)`;
  document.getElementById('coSummaryDeposit').textContent = `₹${formatCurrency(depositTotal)}`;
  document.getElementById('coSummaryTotal').textContent = `₹${formatCurrency(grandTotal)}`;

  closeAllModals();
  openModal('checkoutModal');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const address = document.getElementById('coAddress').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const date = document.getElementById('coDeliveryDate').value;
  const notes = document.getElementById('coNotes').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';

  if (!address) {
    showToast('Please enter your full delivery address.', 'error');
    return;
  }

  const payload = {
    tenure_months: state.cartTenure,
    delivery_address: `${address}${phone ? ` (Phone: ${phone})` : ''}`,
    notes: `Delivery Date: ${date}. Payment: ${paymentMethod.toUpperCase()}. ${notes}`,
    items: state.cart.map(c => ({
      furniture_id: c.id,
      quantity: c.quantity
    }))
  };

  const submitBtn = document.getElementById('btnPlaceOrder');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirming Order...';
  }

  try {
    const res = await fetch(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success && data.rental) {
      // Clear cart
      state.cart = [];
      saveCart();
      updateCartBadge();

      // Show Order Confirmation Screen
      document.getElementById('confRentalCode').textContent = data.rental.rental_code;
      document.getElementById('confStartDate').textContent = data.rental.start_date;
      document.getElementById('confEndDate').textContent = data.rental.end_date;
      document.getElementById('confTenure').textContent = `${data.rental.tenure_months} Months`;
      document.getElementById('confTotal').textContent = `₹${formatCurrency(data.rental.total_amount)}`;
      document.getElementById('confAddress').textContent = data.rental.delivery_address;

      closeAllModals();
      openModal('confirmationModal');
      showToast('Rental booked successfully!', 'success');
    } else {
      showToast(data.message || 'Failed to place rental booking.', 'error');
    }
  } catch (err) {
    showToast('Network error during checkout.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Confirm & Book Rental';
    }
  }
}

/* ============================================================
   MY RENTALS PORTAL
   ============================================================ */
async function openMyRentalsModal() {
  if (!state.token) {
    openModal('authModal');
    return;
  }

  const container = document.getElementById('myRentalsList');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 10px;"></i>
      <p>Loading your rental orders...</p>
    </div>
  `;

  openModal('myRentalsModal');

  try {
    const res = await fetch(`${API_BASE}/rentals/my-rentals`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      renderMyRentals(data.rentals);
    } else {
      container.innerHTML = `<p style="color: var(--danger); text-align: center;">${data.message}</p>`;
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to load rental orders.</p>`;
  }
}

function renderMyRentals(rentals) {
  const container = document.getElementById('myRentalsList');
  if (!container) return;

  if (rentals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px;">
        <i class="fa-solid fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 16px;"></i>
        <h4 style="font-weight: 700; color: var(--dark); margin-bottom: 8px;">No active rentals yet</h4>
        <p style="color: var(--muted); margin-bottom: 20px;">Browse our catalog to furnish your home flexibly.</p>
        <button class="btn-primary" onclick="closeAllModals(); document.getElementById('catalog-section').scrollIntoView({behavior: 'smooth'});">
          Explore Catalog
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = rentals.map(r => {
    const isPending = r.status === 'pending';
    const isApproved = r.status === 'approved';
    const isActive = r.status === 'active';
    const isReturned = r.status === 'returned';

    // Status Timeline step classes
    const step1 = 'completed';
    const step2 = (isApproved || isActive || isReturned) ? 'completed' : (isPending ? 'active' : '');
    const step3 = (isActive || isReturned) ? 'completed' : (isApproved ? 'active' : '');
    const step4 = isReturned ? 'completed' : '';

    return `
      <div class="rental-card">
        <div class="rental-card-top">
          <div>
            <div class="rental-code-title">
              <i class="fa-solid fa-file-invoice" style="color: var(--primary);"></i>
              Order #${escapeHtml(r.rental_code)}
            </div>
            <div style="font-size: 0.8rem; color: var(--muted); margin-top: 4px;">
              Booked on ${new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="status-badge status-${r.status}">
              <i class="fa-solid fa-circle" style="font-size: 6px;"></i> ${r.status}
            </span>
            ${isPending ? `
              <button class="btn-outline" style="color: var(--danger); border-color: #fca5a5; padding: 4px 10px; font-size: 0.8rem;" onclick="cancelRentalOrder(${r.id})">
                Cancel
              </button>
            ` : ''}
          </div>
        </div>

        ${r.status !== 'cancelled' ? `
          <div class="rental-timeline">
            <div class="timeline-step ${step1}">
              <div class="timeline-dot"><i class="fa-solid fa-check"></i></div>
              <div class="timeline-label">Order Booked</div>
            </div>
            <div class="timeline-step ${step2}">
              <div class="timeline-dot"><i class="fa-solid ${isApproved || isActive || isReturned ? 'fa-check' : 'fa-clipboard-check'}"></i></div>
              <div class="timeline-label">Approved</div>
            </div>
            <div class="timeline-step ${step3}">
              <div class="timeline-dot"><i class="fa-solid ${isActive || isReturned ? 'fa-check' : 'fa-truck-fast'}"></i></div>
              <div class="timeline-label">Active / Delivered</div>
            </div>
            <div class="timeline-step ${step4}">
              <div class="timeline-dot"><i class="fa-solid fa-rotate-left"></i></div>
              <div class="timeline-label">Returned</div>
            </div>
          </div>
        ` : `
          <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 0.88rem; color: #b91c1c;">
            <i class="fa-solid fa-circle-xmark"></i> This rental order was cancelled and items have been released back to stock.
          </div>
        `}

        <div style="margin-bottom: 16px;">
          <h5 style="font-size: 0.85rem; color: var(--muted); text-transform: uppercase; margin-bottom: 8px;">Rented Items</h5>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(r.items || []).map(it => `
              <div style="display: flex; align-items: center; justify-content: space-between; background: var(--light-gray); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.88rem;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <img src="${it.image_url}" alt="" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover;">
                  <span style="font-weight: 600;">${escapeHtml(it.name)} × ${it.quantity}</span>
                </div>
                <div>₹${formatCurrency(it.monthly_rate)} / mo</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.85rem; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px;">
          <div><strong style="color: var(--slate);">Tenure:</strong> ${r.tenure_months} Months</div>
          <div><strong style="color: var(--slate);">Duration:</strong> ${r.start_date} to ${r.end_date}</div>
          <div><strong style="color: var(--slate);">Security Deposit:</strong> ₹${formatCurrency(r.security_deposit_total)}</div>
          <div><strong style="color: var(--slate);">Total Paid:</strong> ₹${formatCurrency(r.total_amount)}</div>
        </div>

        <div style="font-size: 0.82rem; color: var(--muted); margin-top: 12px;">
          <i class="fa-solid fa-location-dot"></i> Delivery: ${escapeHtml(r.delivery_address)}
        </div>
      </div>
    `;
  }).join('');
}

async function cancelRentalOrder(rentalId) {
  if (!confirm('Are you sure you want to cancel this pending rental order? Your security deposit will not be charged.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/rentals/${rentalId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      openMyRentalsModal();
    } else {
      showToast(data.message || 'Could not cancel rental order.', 'error');
    }
  } catch (err) {
    showToast('Network error while cancelling order.', 'error');
  }
}

/* ============================================================
   MODAL CONTROLLERS & UTILITIES
   ============================================================ */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    if (document.querySelectorAll('.modal-backdrop.open').length === 0) {
      document.body.style.overflow = '';
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop.open').forEach(modal => {
    modal.classList.remove('open');
  });
  document.body.style.overflow = '';
}

function switchAuthTab(type) {
  const loginSection = document.getElementById('loginSection');
  const regSection = document.getElementById('registerSection');
  const btnLoginTab = document.getElementById('tabLoginBtn');
  const btnRegTab = document.getElementById('tabRegBtn');

  if (type === 'login') {
    if (loginSection) loginSection.style.display = 'block';
    if (regSection) regSection.style.display = 'none';
    if (btnLoginTab) btnLoginTab.classList.add('active');
    if (btnRegTab) btnRegTab.classList.remove('active');
  } else {
    if (loginSection) loginSection.style.display = 'none';
    if (regSection) regSection.style.display = 'block';
    if (btnLoginTab) btnLoginTab.classList.remove('active');
    if (btnRegTab) btnRegTab.classList.add('active');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? 'fa-circle-check'
             : type === 'error' ? 'fa-circle-exclamation'
             : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="font-size: 1.1rem;"></i>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatCurrency(val) {
  const num = parseFloat(val || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
