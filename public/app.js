let products = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';

// DOM Elements
const productGrid = document.getElementById('product-grid');
const cartToggle = document.getElementById('cart-toggle');
const cartSidebar = document.getElementById('cart-sidebar');
const closeCartBtn = document.getElementById('close-cart');
const cartOverlay = document.getElementById('cart-overlay');
const cartItemsContainer = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const cartTotalPrice = document.getElementById('cart-total-price');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutBtn = document.querySelector('.checkout-button');
const closeCheckoutBtn = document.getElementById('close-checkout');
const checkoutForm = document.getElementById('checkout-form');
const submitCheckoutBtn = document.getElementById('submit-checkout');

const authToggle = document.getElementById('auth-toggle');
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const submitAuthBtn = document.getElementById('submit-auth');
const authTitle = document.getElementById('auth-title');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');

let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
let currentUser = localStorage.getItem('currentUser') || '';
let isLoginMode = true;

function updateAuthUI() {
    if (authToggle) {
        if (isLoggedIn) {
            authToggle.innerHTML = `Hi, ${currentUser.split('@')[0]} <span style="color: var(--accent-color); font-size: 0.85rem; margin-left: 6px;">[Dashboard]</span>`;
            authToggle.removeAttribute('data-i18n');
        } else {
            authToggle.setAttribute('data-i18n', 'nav_login');
            if (typeof translations !== 'undefined' && typeof currentLang !== 'undefined') {
                authToggle.textContent = translations[currentLang]['nav_login'];
            } else {
                authToggle.textContent = 'Login';
            }
        }
    }
}

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        if (res.ok) {
            products = await res.json();
        } else {
            console.error('Failed to load products');
        }
    } catch (e) {
        console.error('Error fetching products', e);
    }
}

// Initialize Store
async function initStore() {
    await loadProducts();
    updateAuthUI();
    renderProducts();
    setupEventListeners();
    setupScrollEffects();
}

function setupScrollEffects() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
    observeElements();
}

function observeElements() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scrolled-in');
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.animate-on-scroll:not(.scrolled-in)').forEach(el => {
        observer.observe(el);
    });
}

function renderProducts() {
    if (!productGrid) return;
    let filteredProducts = products.filter(product => {
        const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: var(--text-color);">No products found matching your criteria.</p>';
        return;
    }

    productGrid.innerHTML = filteredProducts.map((product, index) => {
        const delay = (index % 4) * 100;
        return `
        <div class="product-card animate-on-scroll" style="transition-delay: ${delay}ms;">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <button class="add-to-cart" onclick="addToCart(${product.id})">Add to Cart</button>
            </div>
        </div>
    `}).join('');
    
    if(typeof observeElements === "function") {
        setTimeout(observeElements, 50);
    }
}

function setupEventListeners() {
    if(cartToggle) cartToggle.addEventListener('click', toggleCart);
    if(closeCartBtn) closeCartBtn.addEventListener('click', toggleCart);
    if(cartOverlay) cartOverlay.addEventListener('click', toggleCart);
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderProducts();
        });
    }

    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                currentCategory = btn.getAttribute('data-category');
                renderProducts();
            });
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }
            toggleCart(); // Close cart
            checkoutModal.classList.add('open');
        });
    }

    if (closeCheckoutBtn) {
        closeCheckoutBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('open');
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const mobile = document.getElementById('mobile').value;
            if(!mobile || mobile.length < 9) {
                return alert('Fadlan geli nambar sax ah (Please enter a valid mobile number)');
            }

            // Show USSD Overlay
            const ussdOverlay = document.getElementById('ussd-overlay');
            if(ussdOverlay) ussdOverlay.style.display = 'flex';
            
            submitCheckoutBtn.textContent = 'Processing...';
            submitCheckoutBtn.style.opacity = '0.7';

            // Simulate USSD Processing (3 seconds)
            setTimeout(async () => {
                if(ussdOverlay) ussdOverlay.style.display = 'none';

                const checkoutEmail = document.getElementById('checkout-email').value;
                const name = document.getElementById('name').value;
                const address = document.getElementById('address').value;
                const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const paymentMethod = document.getElementById('payment-method').value;

                try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        email: currentUser || checkoutEmail,
                        total: total,
                        items: cart,
                        address: address,
                        payment_method: paymentMethod,
                        payment_contact: mobile
                    })
                });
                
                if (res.ok) {
                    alert('Purchase successful! Thank you.');
                    cart = [];
                    updateCartUI();
                    checkoutModal.classList.remove('open');
                    checkoutForm.reset();
                } else {
                    alert('Order failed to process.');
                }
            } catch (err) {
                alert('Server connection error.');
            } finally {
                submitCheckoutBtn.textContent = 'Complete Purchase';
                submitCheckoutBtn.style.opacity = '1';
            }
            }, 3000);
        });
    }

    if (authToggle) {
        authToggle.addEventListener('click', () => {
            if (isLoggedIn) {
                window.location.href = '/user/dashboard.html';
            } else {
                authModal.classList.add('open');
            }
        });
    }

    if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => {
            authModal.classList.remove('open');
        });
    }

    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            if (isLoginMode) {
                authTitle.textContent = 'Welcome Back';
                submitAuthBtn.textContent = 'Login';
                toggleAuthModeBtn.textContent = 'Sign Up';
                toggleAuthModeBtn.previousElementSibling.textContent = "Don't have an account?";
            } else {
                authTitle.textContent = 'Create Account';
                submitAuthBtn.textContent = 'Register';
                toggleAuthModeBtn.textContent = 'Login';
                toggleAuthModeBtn.previousElementSibling.textContent = "Already have an account?";
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = authEmail.value;
            const password = document.getElementById('auth-password').value;
            
            submitAuthBtn.textContent = 'Processing...';
            submitAuthBtn.style.opacity = '0.7';

            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (res.ok) {
                    if (data.role === 'admin' || data.role === 'employee') {
                        sessionStorage.setItem('adminToken', 'logged_in');
                        sessionStorage.setItem('adminEmail', email);
                        sessionStorage.setItem('adminRole', data.role);
                        window.location.href = '/admin/admin.html';
                    } else {
                        isLoggedIn = true;
                        currentUser = email;
                        localStorage.setItem('isLoggedIn', 'true');
                        localStorage.setItem('currentUser', email);
                        
                        authModal.classList.remove('open');
                        updateAuthUI();
                        authForm.reset();
                        
                        window.location.href = '/user/dashboard.html';
                    }
                } else {
                    alert(data.error || 'Authentication failed');
                }
            } catch (err) {
                alert('Server error connecting to backend.');
            } finally {
                submitAuthBtn.textContent = isLoginMode ? 'Login' : 'Register';
                submitAuthBtn.style.opacity = '1';
            }
        });
    }
}

function toggleCart() {
    cartSidebar.classList.toggle('open');
    cartOverlay.classList.toggle('open');
}

window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    
    if(cartCount) {
        // Tiny animation feedback on badge
        cartCount.style.transform = 'scale(1.5)';
        setTimeout(() => cartCount.style.transform = 'scale(1)', 200);
    }
}

window.removeFromCart = function(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateCartUI() {
    if(!cartCount || !cartItemsContainer || !cartTotalPrice) return;
    // Update Badge
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    // Update Items List
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; color: var(--text-color); margin-top:2rem;">Your cart is empty.</p>';
    } else {
        cartItemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
                    <button class="cart-item-remove" onclick="removeFromCart(${item.id})">Remove</button>
                </div>
            </div>
        `).join('');
    }

    // Update Total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalPrice.textContent = `$${total.toFixed(2)}`;
}

// Start App
initStore();
