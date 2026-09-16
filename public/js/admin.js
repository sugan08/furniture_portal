/**
 * Online Furniture Rental Portal - Admin Portal Logic
 */

let currentAdminTab = 'rentals';
let editingFurnitureId = null;

async function openAdminModal() {
  if (!state.token || !state.user || state.user.role !== 'admin') {
    showToast('Admin privileges required.', 'error');
    return;
  }

  openModal('adminModal');
  await loadAdminStats();
  switchAdminTab('rentals');
}

function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const rentalsSection = document.getElementById('adminTabRentals');
  const inventorySection = document.getElementById('adminTabInventory');
  const usersSection = document.getElementById('adminTabUsers');

  if (rentalsSection) rentalsSection.style.display = tab === 'rentals' ? 'block' : 'none';
  if (inventorySection) inventorySection.style.display = tab === 'inventory' ? 'block' : 'none';
  if (usersSection) usersSection.style.display = tab === 'users' ? 'block' : 'none';

  if (tab === 'rentals') loadAdminRentals();
  if (tab === 'inventory') loadAdminInventory();
  if (tab === 'users') loadAdminUsers();
}

/* ============================================================
   ADMIN STATS / KPI CARDS
   ============================================================ */
async function loadAdminStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success && data.stats) {
      const { rentals, inventory, users } = data.stats;

      document.getElementById('statTotalRevenue').textContent = `₹${formatCurrency(rentals.total_revenue || 0)}`;
      document.getElementById('statActiveRentals').textContent = rentals.active_rentals || 0;
      document.getElementById('statPendingRentals').textContent = rentals.pending_rentals || 0;
      document.getElementById('statTotalItems').textContent = `${inventory.total_items || 0} (${inventory.total_stock || 0} units)`;
      document.getElementById('statTotalUsers').textContent = users.total_customers || 0;
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

/* ============================================================
   RENTAL ORDERS MANAGEMENT
   ============================================================ */
async function loadAdminRentals() {
  const tableBody = document.getElementById('adminRentalsTableBody');
  const statusFilter = document.getElementById('adminRentalFilterStatus')?.value || 'all';
  const searchInput = document.getElementById('adminRentalSearchInput')?.value || '';

  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading rental orders...</td></tr>`;

  try {
    let url = `${API_BASE}/admin/rentals?status=${statusFilter}`;
    if (searchInput.trim()) {
      url += `&search=${encodeURIComponent(searchInput.trim())}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (!data.success || !data.rentals || data.rentals.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--muted);">No rental orders matching criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.rentals.map(r => `
      <tr>
        <td>
          <strong style="color: var(--primary);">#${escapeHtml(r.rental_code)}</strong>
          <div style="font-size: 0.75rem; color: var(--muted);">${new Date(r.created_at).toLocaleDateString('en-IN')}</div>
        </td>
        <td>
          <strong>${escapeHtml(r.customer_name)}</strong>
          <div style="font-size: 0.75rem; color: var(--muted);">${escapeHtml(r.customer_email)}</div>
          <div style="font-size: 0.75rem; color: var(--muted);">${escapeHtml(r.customer_phone || '')}</div>
        </td>
        <td>
          <span class="badge" style="background: #e2e8f0; color: #334155;">${r.tenure_months} Months</span>
          <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px;">${r.start_date} to ${r.end_date}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem;">${(r.items || []).map(i => `${escapeHtml(i.name)} (×${i.quantity})`).join(', ')}</div>
        </td>
        <td>
          <strong style="color: var(--dark);">₹${formatCurrency(r.total_amount)}</strong>
          <div style="font-size: 0.75rem; color: var(--muted);">Dep: ₹${formatCurrency(r.security_deposit_total)}</div>
        </td>
        <td>
          <select class="form-control" style="padding: 4px 8px; font-size: 0.8rem; font-weight: 600;" onchange="updateRentalStatus(${r.id}, this.value)">
            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="approved" ${r.status === 'approved' ? 'selected' : ''}>📋 Approved</option>
            <option value="active" ${r.status === 'active' ? 'selected' : ''}>🚚 Active (In-Use)</option>
            <option value="returned" ${r.status === 'returned' ? 'selected' : ''}>🔄 Returned</option>
            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </td>
        <td>
          <button class="btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="viewAdminRentalDetails(${r.id})">
            <i class="fa-solid fa-eye"></i> Details
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Failed to load rental orders.</td></tr>`;
  }
}

async function updateRentalStatus(rentalId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/rentals/${rentalId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminStats();
      loadAdminRentals();
    } else {
      showToast(data.message || 'Status update failed.', 'error');
      loadAdminRentals();
    }
  } catch (err) {
    showToast('Network error while updating status.', 'error');
  }
}

async function viewAdminRentalDetails(rentalId) {
  try {
    const res = await fetch(`${API_BASE}/rentals/${rentalId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success && data.rental) {
      const r = data.rental;
      const detailsHtml = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
          <p><strong>Rental Code:</strong> #${r.rental_code}</p>
          <p><strong>Customer:</strong> ${r.customer?.name} (${r.customer?.email}) - ${r.customer?.phone || 'N/A'}</p>
          <p><strong>Delivery Address:</strong> ${r.delivery_address}</p>
          <p><strong>Notes:</strong> ${r.notes || 'None'}</p>
          <p><strong>Dates:</strong> ${r.start_date} to ${r.end_date} (${r.tenure_months} Months)</p>
          <p><strong>Rent Total:</strong> ₹${formatCurrency(r.monthly_rent_total * r.tenure_months)} | <strong>Discount:</strong> -₹${formatCurrency(r.discount_amount)}</p>
          <p><strong>Deposit Total:</strong> ₹${formatCurrency(r.security_deposit_total)} | <strong>Grand Total:</strong> ₹${formatCurrency(r.total_amount)}</p>
          <h5 style="margin-top: 14px; margin-bottom: 6px;">Items:</h5>
          <ul>
            ${r.items.map(i => `<li>${i.name} (Qty: ${i.quantity}) - ₹${formatCurrency(i.monthly_rate)}/mo, Deposit: ₹${formatCurrency(i.security_deposit)}</li>`).join('')}
          </ul>
        </div>
      `;

      document.getElementById('adminRentalDetailsBody').innerHTML = detailsHtml;
      openModal('adminRentalDetailsModal');
    }
  } catch (err) {
    showToast('Failed to load details.', 'error');
  }
}

/* ============================================================
   INVENTORY MANAGEMENT (CRUD)
   ============================================================ */
async function loadAdminInventory() {
  const tableBody = document.getElementById('adminInventoryTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading inventory catalog...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/furniture`);
    const data = await res.json();

    if (!data.success || !data.items || data.items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--muted);">No inventory items found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.items.map(item => `
      <tr>
        <td>
          <img src="${item.image_url}" alt="" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;">
        </td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          <div style="font-size: 0.75rem; color: var(--muted);">${escapeHtml(item.dimensions || 'Standard')} • ${escapeHtml(item.material || 'Wood')}</div>
        </td>
        <td>
          <span class="badge badge-category">${escapeHtml(item.category_name)}</span>
        </td>
        <td>
          <strong>₹${formatCurrency(item.monthly_rate)}</strong><span style="font-size: 0.75rem; color: var(--muted);">/mo</span>
        </td>
        <td>
          ₹${formatCurrency(item.security_deposit)}
        </td>
        <td>
          <span style="font-weight: 700; color: ${item.stock_quantity > 2 ? 'var(--success)' : 'var(--danger)'};">
            ${item.stock_quantity} units
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openEditFurnitureModal(${item.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger); border-color: #fca5a5;" onclick="deleteFurnitureItem(${item.id})">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Failed to load inventory.</td></tr>`;
  }
}

function openAddFurnitureModal() {
  editingFurnitureId = null;
  document.getElementById('furnModalTitle').textContent = 'Add New Furniture Item';
  document.getElementById('furnForm').reset();
  populateCategorySelect();
  openModal('furnitureFormModal');
}

async function openEditFurnitureModal(id) {
  editingFurnitureId = id;
  document.getElementById('furnModalTitle').textContent = 'Edit Furniture Item';
  populateCategorySelect();

  try {
    const res = await fetch(`${API_BASE}/furniture/${id}`);
    const data = await res.json();
    if (data.success && data.item) {
      const it = data.item;
      document.getElementById('furnName').value = it.name;
      document.getElementById('furnCategory').value = it.category_id;
      document.getElementById('furnMonthlyRate').value = it.monthly_rate;
      document.getElementById('furnDeposit').value = it.security_deposit;
      document.getElementById('furnStock').value = it.stock_quantity;
      document.getElementById('furnDimensions').value = it.dimensions || '';
      document.getElementById('furnMaterial').value = it.material || '';
      document.getElementById('furnImage').value = it.image_url || '';
      document.getElementById('furnDesc').value = it.description || '';
      document.getElementById('furnFeatured').checked = !!it.featured;

      openModal('furnitureFormModal');
    }
  } catch (err) {
    showToast('Failed to fetch item details.', 'error');
  }
}

function populateCategorySelect() {
  const select = document.getElementById('furnCategory');
  if (!select) return;

  select.innerHTML = state.categories.map(c => `
    <option value="${c.id}">${c.name}</option>
  `).join('');
}

async function handleFurnitureSubmit(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById('furnName').value.trim(),
    category_id: parseInt(document.getElementById('furnCategory').value, 10),
    monthly_rate: parseFloat(document.getElementById('furnMonthlyRate').value),
    security_deposit: parseFloat(document.getElementById('furnDeposit').value),
    stock_quantity: parseInt(document.getElementById('furnStock').value, 10),
    dimensions: document.getElementById('furnDimensions').value.trim(),
    material: document.getElementById('furnMaterial').value.trim(),
    image_url: document.getElementById('furnImage').value.trim(),
    description: document.getElementById('furnDesc').value.trim(),
    featured: document.getElementById('furnFeatured').checked ? 1 : 0
  };

  const isEdit = editingFurnitureId !== null;
  const url = isEdit ? `${API_BASE}/furniture/${editingFurnitureId}` : `${API_BASE}/furniture`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message || 'Saved successfully!', 'success');
      closeModal('furnitureFormModal');
      loadAdminInventory();
      loadAdminStats();
      fetchFurniture(); // Refresh main catalog
    } else {
      showToast(data.message || 'Failed to save item.', 'error');
    }
  } catch (err) {
    showToast('Network error while saving item.', 'error');
  }
}

async function deleteFurnitureItem(id) {
  if (!confirm('Are you sure you want to delete this furniture item from the catalog?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/furniture/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      showToast('Item deleted successfully.', 'success');
      loadAdminInventory();
      loadAdminStats();
      fetchFurniture();
    } else {
      showToast(data.message || 'Could not delete item.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting item.', 'error');
  }
}

/* ============================================================
   USER / CUSTOMER REGISTRY
   ============================================================ */
async function loadAdminUsers() {
  const tableBody = document.getElementById('adminUsersTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading customers...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (!data.success || !data.users || data.users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--muted);">No users found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.users.map(u => `
      <tr>
        <td>
          <strong>${escapeHtml(u.name)}</strong>
          <div style="font-size: 0.75rem; color: var(--muted);">Joined: ${new Date(u.created_at).toLocaleDateString('en-IN')}</div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>
          <span class="badge" style="background: ${u.role === 'admin' ? '#fef3c7; color: #b45309;' : '#eff6ff; color: #1d4ed8;'}">
            ${u.role}
          </span>
        </td>
        <td>${escapeHtml(u.phone || 'N/A')}</td>
        <td>
          <strong>${u.rental_count}</strong> orders
        </td>
        <td>
          <strong>₹${formatCurrency(u.total_spent)}</strong>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 20px;">Failed to load user registry.</td></tr>`;
  }
}
