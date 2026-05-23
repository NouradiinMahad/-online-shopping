document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('currentUser');
    if(!email) return;

    document.getElementById('display-user-email').textContent = email.split('@')[0];
    document.getElementById('update-current-email').value = email;

    // Tab Switching
    const tabs = ['orders', 'settings'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        const sec = document.getElementById(`section-${tab}`);
        if(btn && sec) {
            btn.addEventListener('click', () => {
                tabs.forEach(t => {
                    document.getElementById(`tab-${t}`).classList.remove('active');
                    document.getElementById(`section-${t}`).style.display = 'none';
                });
                btn.classList.add('active');
                sec.style.display = 'block';

                const pageTitle = document.getElementById('page-title');
                if (tab === 'orders') pageTitle.textContent = "Order History";
                if (tab === 'settings') pageTitle.textContent = "Profile Management";
            });
        }
    });

    // Theme Logic
    const savedTheme = localStorage.getItem('site_theme') || 'dark';
    if(savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
    
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
        btn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-mode');
            const newTheme = isLight ? 'light' : 'dark';
            localStorage.setItem('site_theme', newTheme);
            document.querySelectorAll('.theme-toggle').forEach(b => {
                b.textContent = isLight ? '🌙' : '☀️';
            });
        });
    });

    // Fetch Orders
    async function loadOrders() {
        const tbody = document.getElementById('user-orders-body');
        try {
            const res = await fetch(`/api/user/dashboard?email=${encodeURIComponent(email)}`);
            if (res.ok) {
                const data = await res.json();
                if(data.orders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; opacity: 0.7;">You have no prior orders.</td></tr>';
                } else {
                    tbody.innerHTML = data.orders.map(o => {
                        let statusBadgeClass = 'status-pending';
                        if (o.status === 'Shipped') statusBadgeClass = 'status-shipped';
                        if (o.status === 'Delivered') statusBadgeClass = 'status-delivered';
                        
                        const paymentMethod = o.payment_method || 'N/A';
                        const paymentStatus = o.payment_status || 'pending';
                        
                        return `
                        <tr style="border-bottom: 1px solid var(--glass-border);">
                            <td style="padding: 1rem; padding-left: 0;">#${o.id}</td>
                            <td style="padding: 1rem; color: var(--accent-color); font-weight: bold;">$${o.total.toFixed(2)}</td>
                            <td style="padding: 1rem; opacity: 0.8;">${o.address}</td>
                            <td style="padding: 1rem; font-size: 0.9rem;">
                                <strong style="color: var(--accent-color); text-transform: uppercase;">${paymentMethod}</strong><br>
                                <span style="color: ${paymentStatus === 'paid' ? '#28a745' : '#ffc107'}; text-transform: capitalize;">${paymentStatus}</span>
                            </td>
                            <td style="padding: 1rem;"><span class="status-badge ${statusBadgeClass}">${o.status}</span></td>
                            <td style="padding: 1rem; opacity: 0.8;">${o.date.split(' ')[0]}</td>
                        </tr>
                        `;
                    }).join('');
                }
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading orders</td></tr>';
        }
    }

    // Profile Update Submission
    const profileForm = document.getElementById('profile-update-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-profile-btn');
            const statusLine = document.getElementById('profile-status');
            const newEmail = document.getElementById('update-new-email').value;
            const newPassword = document.getElementById('update-new-password').value;

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
                        email: email,
                        new_email: newEmail || null,
                        new_password: newPassword || null
                    })
                });

                const data = await res.json();
                if(res.ok) {
                    statusLine.textContent = data.message;
                    statusLine.style.color = 'var(--accent-color)';
                    
                    if(newEmail) {
                        localStorage.setItem('currentUser', newEmail);
                        document.getElementById('update-current-email').value = newEmail;
                        document.getElementById('display-user-email').textContent = newEmail.split('@')[0];
                        document.getElementById('update-new-email').value = '';
                    }
                    if(newPassword) {
                        document.getElementById('update-new-password').value = '';
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
                btn.textContent = "Save Changes";
            }
        });
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentUser');
        window.location.href = '../index.html';
    });

    loadOrders();
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

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 900) {
                    dashboardSidebar.classList.remove('open');
                }
            });
        });
    }
});

