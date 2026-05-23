document.addEventListener('DOMContentLoaded', () => {
    
    function showConfirmDialog(msg, onConfirm) {
        const modal = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('custom-confirm-msg');
        const btnCancel = document.getElementById('custom-confirm-cancel');
        const btnYes = document.getElementById('custom-confirm-yes');
        if(!modal) return window.confirm(msg) ? onConfirm() : null;
        msgEl.textContent = msg;
        modal.classList.add('open');
        const close = () => { modal.classList.remove('open'); btnCancel.onclick = null; btnYes.onclick = null; };
        btnCancel.onclick = close;
        btnYes.onclick = () => { close(); onConfirm(); };
    }
    // Auth Validation & Scoping
    const adminRole = sessionStorage.getItem('adminRole');
    if (!sessionStorage.getItem('adminToken')) {
        window.location.href = '../login.html';
    }
    
    // Reveal Manage Users if Master Admin
    const tabManageUsers = document.getElementById('tab-manage-users');
    const sectionManageUsers = document.getElementById('section-manage-users');
    if (adminRole === 'admin' && tabManageUsers) {
        tabManageUsers.style.display = 'block';
    }

    // Tab Switching
    const tabs = ['dashboard', 'add-product', 'manage-products', 'manage-users', 'settings'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        const sec = document.getElementById(`section-${tab}`);
        if(btn && sec) {
            btn.addEventListener('click', () => {
                // hide all
                tabs.forEach(t => {
                    if (document.getElementById(`tab-${t}`)) {
                        document.getElementById(`tab-${t}`).classList.remove('active');
                        document.getElementById(`section-${t}`).style.display = 'none';
                    }
                });
                // show current
                btn.classList.add('active');
                sec.style.display = 'block';

                const pageTitle = document.getElementById('page-title');
                if (tab === 'dashboard') pageTitle.textContent = "Dashboard Overview";
                if (tab === 'add-product') pageTitle.textContent = "Deploy Products";
                if (tab === 'manage-products') pageTitle.textContent = "Inventory Hub";
                if (tab === 'manage-users') pageTitle.textContent = "Identity Access Management";
                if (tab === 'settings') pageTitle.textContent = "Operations Settings";
                
                if (tab === 'manage-users') fetchUsers();
            });
        }
    });

    // Employee Rebranding
    if (adminRole === 'employee') {
        const sidebarTitle = document.querySelector('.sidebar-logo span');
        if (sidebarTitle) sidebarTitle.textContent = "EMPLOYEE";
        
        const mainHeaderDiv = document.querySelector('.admin-header div');
        if (mainHeaderDiv) {
            const subText = mainHeaderDiv.querySelector('div');
            if (subText) subText.textContent = "Employee Operations Portal";
        }
    }

    // Settings & Profile Logic
    const adminEmailField = document.getElementById('admin-update-current-email');
    if (adminEmailField) {
        adminEmailField.value = sessionStorage.getItem('adminEmail');
    }
    
    const adminProfileForm = document.getElementById('admin-profile-update-form');
    if (adminProfileForm) {
        adminProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('admin-submit-profile-btn');
            const statusLine = document.getElementById('admin-profile-status');
            const currentEmail = sessionStorage.getItem('adminEmail');
            const newEmail = document.getElementById('admin-update-new-email').value;
            const newPassword = document.getElementById('admin-update-new-password').value;

            if(!newEmail && !newPassword) {
                statusLine.textContent = "Please fill at least one field to update.";
                statusLine.style.color = 'var(--text-color)';
                return;
            }

            btn.disabled = true;
            btn.textContent = "Saving...";
            
            try {
                const res = await fetch('/api/users/update_profile', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        email: currentEmail,
                        new_email: newEmail || null,
                        new_password: newPassword || null
                    })
                });

                const data = await res.json();
                if(res.ok) {
                    statusLine.textContent = data.message;
                    statusLine.style.color = 'var(--accent-color)';
                    
                    if(newEmail) {
                        sessionStorage.setItem('adminEmail', newEmail);
                        document.getElementById('admin-update-current-email').value = newEmail;
                        document.getElementById('admin-update-new-email').value = '';
                    }
                    if(newPassword) {
                        document.getElementById('admin-update-new-password').value = '';
                    }
                } else {
                    statusLine.textContent = data.error || "Update failed";
                    statusLine.style.color = 'red';
                }
            } catch(err) {
                statusLine.textContent = "Network error";
                statusLine.style.color = 'red';
            } finally {
                btn.disabled = false;
                btn.textContent = "Save Configurations";
            }
        });
    }

    // Logout Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminEmail');
            sessionStorage.removeItem('adminRole');
            window.location.href = '../login.html';
        });
    }

    // Dashboard Engine
    async function loadDashboard() {
        try {
            const res = await fetch('/api/admin/dashboard');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-revenue').textContent = `$${data.total_revenue.toFixed(2)}`;
                document.getElementById('stat-orders').textContent = data.total_orders;
                document.getElementById('stat-users').textContent = data.total_users;
                document.getElementById('stat-products').textContent = data.total_products;
                
                renderRecentOrders(data.recent_orders || []);
                renderChart(data);
            }
        } catch (err) {
            console.error("Dashboard error:", err);
        }
    }

    function renderRecentOrders(orders) {
        const tbody = document.getElementById('orders-table-body');
        const msg = document.getElementById('no-orders-msg');
        
        if (orders.length === 0) {
            tbody.innerHTML = '';
            msg.style.display = 'block';
            return;
        }
        
        msg.style.display = 'none';
        
        tbody.innerHTML = orders.map(order => {
            const currentStatus = order.status || 'Pending';
            let statusBadgeClass = 'status-pending';
            if (currentStatus === 'Shipped') statusBadgeClass = 'status-shipped';
            if (currentStatus === 'Delivered') statusBadgeClass = 'status-delivered';
            
            const paymentMethod = order.payment_method || 'N/A';
            const paymentContact = order.payment_contact || 'N/A';
            const paymentStatus = order.payment_status || 'pending';
            
            let adminPaymentControls = '';
            if (adminRole === 'admin') {
                adminPaymentControls = `
                    <br>
                    <select class="payment-status-dropdown" data-id="${order.id}" style="margin-top: 5px; background: var(--bg-color); color: var(--text-color); border: 1px solid var(--glass-border); padding: 2px; border-radius: 4px; font-size: 0.8rem;">
                        <option value="pending" ${paymentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${paymentStatus === 'paid' ? 'selected' : ''}>Paid</option>
                        <option value="failed" ${paymentStatus === 'failed' ? 'selected' : ''}>Failed</option>
                    </select>
                    <button class="update-payment-btn" data-id="${order.id}" style="background: transparent; color: var(--text-color); border: 1px solid var(--accent-color); padding: 2px 5px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Set</button>
                `;
            }

            const dateStr = order.date ? new Date(order.date.replace(' ', 'T')).toLocaleString() : 'N/A';
            return `
            <tr style="border-bottom: 1px solid var(--glass-border);">
                <td style="padding: 1rem; padding-left:0;">#${order.id}</td>
                <td style="padding: 1rem; font-size: 0.85rem; opacity: 0.8;">${dateStr}</td>
                <td style="padding: 1rem;">${order.user_email}</td>
                <td style="padding: 1rem; font-weight: bold; color: var(--accent-color);">$${order.total.toFixed(2)}</td>
                <td style="padding: 1rem; opacity: 0.8;">${order.address}</td>
                <td style="padding: 1rem; font-size: 0.9rem;">
                    <strong style="color: var(--accent-color); text-transform: uppercase;">${paymentMethod}</strong><br>
                    <span style="opacity: 0.8;">${paymentContact}</span><br>
                    <span style="color: ${paymentStatus === 'paid' ? '#28a745' : '#ffc107'};">${paymentStatus}</span>
                    ${adminPaymentControls}
                </td>
                <td style="padding: 1rem;">
                    <span class="status-badge ${statusBadgeClass}">${currentStatus}</span>
                </td>
                <td style="padding: 1rem;">
                    <select class="status-dropdown" data-id="${order.id}" style="background: var(--bg-color); color: var(--text-color); border: 1px solid var(--glass-border); padding: 4px; border-radius: 4px;">
                        <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Shipped" ${currentStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                    <button class="update-status-btn" data-id="${order.id}" style="background: transparent; color: var(--text-color); border: 1px solid var(--accent-color); padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px;">Update</button>
                    ${adminRole === 'admin' ? `<button class="delete-order-btn" data-id="${order.id}" style="background:transparent; color:red; border:1px solid red; padding: 4px 8px; border-radius:4px; cursor:pointer; margin-left: 5px; margin-top:5px;">Delete</button>` : ''}
                </td>
            </tr>
        `}).join('');

        // Attach event listeners for update buttons
        document.querySelectorAll('.update-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const selectElement = document.querySelector(`.status-dropdown[data-id="${id}"]`);
                const newStatus = selectElement.value;
                
                try {
                    const r = await fetch('/api/orders/update_status', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id, status: newStatus })
                    });
                    if (r.ok) {
                        const originalText = e.target.textContent;
                        e.target.textContent = "Saved!";
                        e.target.style.background = "var(--accent-color)";
                        e.target.style.color = "var(--bg-color)";
                        setTimeout(() => {
                            loadDashboard(); // Refresh table silently
                        }, 500);
                    } else {
                        alert("Failed to update status");
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        });
        
        // Attach event listeners for payment update buttons (only admin)
        document.querySelectorAll('.update-payment-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const selectElement = document.querySelector(`.payment-status-dropdown[data-id="${id}"]`);
                if(!selectElement) return;
                const newStatus = selectElement.value;
                
                try {
                    const r = await fetch('/api/orders/update_payment', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id, payment_status: newStatus })
                    });
                    if (r.ok) {
                        const originalText = e.target.textContent;
                        e.target.textContent = "Saved!";
                        e.target.style.background = "var(--accent-color)";
                        e.target.style.color = "var(--bg-color)";
                        setTimeout(() => {
                            loadDashboard(); // Refresh table silently
                        }, 500);
                    } else {
                        alert("Failed to update payment status");
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        });

        // Attach event listeners for delete order buttons (only admin)
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                showConfirmDialog("Are you sure you want to completely delete this order?", async () => {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const r = await fetch('/api/orders', {
                            method: 'DELETE',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ id: Number(id) })
                        });
                        if (r.ok) {
                            loadDashboard();
                        } else {
                            const errorData = await r.json();
                            alert(errorData.error || "Failed to delete order");
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Network error processing deletion");
                    }
                });
            });
        });
    }

    let myChart = null;
    function renderChart(data) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        
        if (myChart) myChart.destroy();
        
        myChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Electronics', 'Accessories', 'Lifestyle'],
                datasets: [{
                    label: 'Revenue Split',
                    data: [
                        data.total_revenue * 0.5 || 500, 
                        data.total_revenue * 0.3 || 300, 
                        data.total_revenue * 0.2 || 200
                    ],
                    backgroundColor: [
                        '#d4af37',
                        '#66fcf1',
                        'rgba(255, 255, 255, 0.4)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { color: '#fff', font: { size: 14 } } 
                    }
                }
            }
        });
    }

    // Add Product Logic
    const addProductForm = document.getElementById('add-product-form');
    
    // File input visual feedback
    const prodImageFile = document.getElementById('prod-image-file');
    if (prodImageFile) {
        prodImageFile.addEventListener('change', function() {
            const nameEl = document.getElementById('upload-file-name');
            if (nameEl) {
                nameEl.textContent = this.files.length > 0 ? this.files[0].name : 'Tap to select a photo';
                nameEl.style.color = this.files.length > 0 ? '#28a745' : 'var(--text-color)';
            }
        });
    }

    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-prod-btn');
            const statusText = document.getElementById('upload-status');
            
            const name = document.getElementById('prod-name').value;
            const price = parseFloat(document.getElementById('prod-price').value);
            const category = document.getElementById('prod-category').value;
            const image = document.getElementById('prod-image').value;
            
            btn.disabled = true;
            btn.textContent = 'Uploading...';
            statusText.textContent = '';
            
            try {
                let imageBase64 = null;
                const fileInput = document.getElementById('prod-image-file');
                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    imageBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                }

                const res = await fetch('/api/products', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name, price, category, image, image_base64: imageBase64 })
                });
                
                if (res.ok) {
                    statusText.textContent = 'Product successfully added!';
                    addProductForm.reset();
                    loadProductsList();
                    loadDashboard();
                } else {
                    statusText.textContent = 'Error adding product.';
                    statusText.style.color = 'red';
                }
            } catch (err) {
                statusText.textContent = 'Network error.';
                statusText.style.color = 'red';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Upload & Add Product';
            }
        });
    }

    // Manage Products Logic
    async function loadProductsList() {
        const tbody = document.getElementById('manage-products-table-body');
        const msg = document.getElementById('no-products-msg');
        if(!tbody) return;

        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const products = await res.json();
                if (products.length === 0) {
                    tbody.innerHTML = '';
                    msg.style.display = 'block';
                } else {
                    msg.style.display = 'none';
                    tbody.innerHTML = products.map(p => `
                        <tr style="border-bottom: 1px solid var(--glass-border);">
                            <td style="padding: 1rem; padding-left:0;">
                                <img src="${p.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            </td>
                            <td style="padding: 1rem;">${p.name}</td>
                            <td style="padding: 1rem;">${p.category}</td>
                            <td style="padding: 1rem;">$${p.price.toFixed(2)}</td>
                            <td style="padding: 1rem;">
                                <button class="delete-btn" data-id="${p.id}" style="background:var(--bg-color); color:red; border:1px solid red; padding: 4px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">DELETE</button>
                            </td>
                        </tr>
                    `).join('');

                    // Attach delete listeners
                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            showConfirmDialog("Are you sure you want to permanently delete this product?", async () => {
                                const id = e.target.getAttribute('data-id');
                                const res = await fetch('/api/products', {
                                    method: 'DELETE',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({ id: Number(id) })
                                });
                                if (res.ok) {
                                    loadProductsList();
                                    loadDashboard();
                                } else {
                                    alert('Failed to delete product.');
                                }
                            });
                        });
                    });
                }
            }
        } catch (err) {
            console.error("Error loading products:", err);
        }
    }

    // Manage Users Logic
    async function fetchUsers() {
        const tbody = document.getElementById('manage-users-table-body');
        if (!tbody) return;

        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const users = await res.json();
                tbody.innerHTML = users.map(u => `
                    <tr style="border-bottom: 1px solid var(--glass-border);">
                        <td style="padding: 1rem; padding-left:0; opacity: 0.6;">#${u.id}</td>
                        <td style="padding: 1rem; font-weight: 600;">${u.email}</td>
                        <td style="padding: 1rem;">
                            <span class="status-badge" style="background: ${u.role==='admin'?'var(--accent-color)': u.role==='employee'?'#17a2b8':'rgba(255,255,255,0.1)'}">${u.role}</span>
                        </td>
                        <td style="padding: 1rem;">
                            <select class="user-role-dropdown" data-id="${u.id}" style="background: var(--bg-color); color: var(--text-color); border: 1px solid var(--glass-border); padding: 4px; border-radius: 4px;">
                                <option value="pending" ${u.role === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Employee</option>
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                            <button class="update-role-btn" data-id="${u.id}" style="background: transparent; color: var(--accent-color); border: 1px solid var(--accent-color); padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px;">Grant</button>
                        </td>
                    </tr>
                `).join('');

                // Attach update role listeners
                document.querySelectorAll('.update-role-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-id');
                        const selectElement = document.querySelector(`.user-role-dropdown[data-id="${id}"]`);
                        const newRole = selectElement.value;
                        
                        try {
                            const r = await fetch('/api/users/role', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ id, role: newRole })
                            });
                            if (r.ok) {
                                const originalText = e.target.textContent;
                                e.target.textContent = "Saved!";
                                e.target.style.background = "var(--accent-color)";
                                e.target.style.color = "var(--bg-color)";
                                setTimeout(() => {
                                    fetchUsers(); // Refresh silently
                                }, 500);
                            } else {
                                alert("Failed to update user role");
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                });
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    }

    const createUserForm = document.getElementById('admin-create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = createUserForm.querySelector('button[type="submit"]');
            const email = document.getElementById('new-user-email').value;
            const password = document.getElementById('new-user-pass').value;
            const role = document.getElementById('new-user-role').value;
            
            btn.disabled = true;
            btn.textContent = 'Working...';
            
            try {
                const res = await fetch('/api/users/create', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, password, role })
                });
                
                if (res.ok) {
                    alert('Account successfully created!');
                    createUserForm.reset();
                    fetchUsers();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Creation failed.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Provision Identity';
            }
        });
    }

    // Init
    loadDashboard();
    loadProductsList();
});

document.addEventListener('DOMContentLoaded', () => {
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const dashboardSidebar = document.getElementById('dashboard-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    if(mobileSidebarToggle && dashboardSidebar) {
        mobileSidebarToggle.addEventListener('click', () => {
            dashboardSidebar.classList.add('open');
        });
        
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                dashboardSidebar.classList.remove('open');
            });
        }

        // Close sidebar when clicking a tab on mobile
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 900) {
                    dashboardSidebar.classList.remove('open');
                }
            });
        });
    }
});

