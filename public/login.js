document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-pass');
    const errorText = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passInput.value;
        
        if(!email || !password) {
            errorText.textContent = "Please fill in all fields.";
            return;
        }

        if (!email.endsWith('@gmail.com') && !email.endsWith('@carfoon.com')) {
            errorText.textContent = "Email must end with @gmail.com.";
            return;
        }

        if (password.length < 6 || password.length > 8) {
            errorText.textContent = "Password must be between 6 and 8 digits/characters.";
            return;
        }

        if (!/^\d+$/.test(password) && !email.endsWith('@carfoon.com')) {
            errorText.textContent = "Password must contain only numbers.";
            return;
        }

        loginBtn.textContent = 'Processing...';
        loginBtn.disabled = true;

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(res => res.json().then(data => ({ status: res.status, body: data })))
        .then(({ status, body }) => {
            if (status === 200) {
                if (body.role === 'admin' || body.role === 'employee') {
                    // It's an admin/employee logging in from main site
                    sessionStorage.setItem('adminToken', 'logged_in');
                    sessionStorage.setItem('adminEmail', email);
                    sessionStorage.setItem('adminRole', body.role);
                    window.location.href = '/admin/admin.html';
                } else if (body.role === 'user') {
                    // Regular user
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('currentUser', email);
                    window.location.href = '/user/dashboard.html';
                } else {
                    // Fallback
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('currentUser', email);
                    window.location.href = 'index.html';
                }
            } else {
                // Error
                errorText.textContent = body.error || "Login failed. Invalid credentials.";
                loginBtn.textContent = 'Login';
                loginBtn.disabled = false;
            }
        })
        .catch(err => {
            console.error("Login error:", err);
            errorText.textContent = "A network error occurred. Please try again.";
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        });
    });
});
