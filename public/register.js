document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
    }

    const registerForm = document.getElementById('register-form');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-pass');
    const passConfirmInput = document.getElementById('reg-pass-confirm');
    const errorText = document.getElementById('reg-error');
    const successText = document.getElementById('reg-success');
    const regBtn = document.getElementById('reg-btn');

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        errorText.textContent = "";
        successText.textContent = "";

        const email = emailInput.value.trim();
        const password = passInput.value;
        const confirmPassword = passConfirmInput.value;
        
        if (!email || !password || !confirmPassword) {
            errorText.textContent = "Please fill in all fields.";
            return;
        }

        if (!email.endsWith('@gmail.com')) {
            errorText.textContent = "Email must end with @gmail.com.";
            return;
        }

        if (password.length < 6 || password.length > 8) {
            errorText.textContent = "Password must be between 6 and 8 digits/characters.";
            return;
        }

        if (!/^\d+$/.test(password)) {
            errorText.textContent = "Password must contain only numbers.";
            return;
        }

        if (password !== confirmPassword) {
            errorText.textContent = "Passwords do not match!";
            return;
        }

        regBtn.textContent = 'Processing...';
        regBtn.disabled = true;

        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(res => res.json().then(data => ({ status: res.status, body: data })))
        .then(({ status, body }) => {
            if (status === 200 || status === 201) {
                // Success
                successText.textContent = "Registration successful! Redirecting to login...";
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                // Error (e.g., User already exists)
                errorText.textContent = body.error || "Registration failed.";
                regBtn.textContent = 'Register';
                regBtn.disabled = false;
            }
        })
        .catch(err => {
            console.error("Registration error:", err);
            errorText.textContent = "A network error occurred. Please try again.";
            regBtn.textContent = 'Register';
            regBtn.disabled = false;
        });
    });
});
