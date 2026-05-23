import http.server
import socketserver
import sqlite3
import json
import urllib.parse
import os
import base64
import uuid

PORT = int(os.environ.get("PORT", 3000))
DB_FILE = "carfoon.db"

# Ensure public dir path
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Create tables
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image TEXT NOT NULL
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total REAL,
        address TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL
    )''')
    try:
        c.execute("ALTER TABLE orders ADD COLUMN guest_email TEXT")
    except sqlite3.OperationalError:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        amount REAL,
        payment_method TEXT,
        payment_contact TEXT,
        status TEXT DEFAULT 'pending'
    )''')
    try:
        c.execute("ALTER TABLE payments ADD COLUMN payment_contact TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    c.execute('''CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER
    )''')
    
    # Mock data
    c.execute('SELECT COUNT(*) FROM users')
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO users (email, password, role) VALUES ('admin@carfoon.com', 'admin123', 'admin')")
        c.execute("INSERT INTO users (email, password, role) VALUES ('employee@carfoon.com', 'emp123', 'employee')")
        c.execute("INSERT INTO users (email, password, role) VALUES ('user@carfoon.com', 'user123', 'user')")

    c.execute('SELECT COUNT(*) FROM products')
    if c.fetchone()[0] == 0:
        mock_products = [
            ("Ergonomic Keyboard", 129.99, "electronics", "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=80"),
            ("Noise-Cancelling Headphones", 249.99, "electronics", "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=80"),
            ("Premium Leather Wallet", 59.99, "accessories", "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=500&q=80"),
            ("Ceramic Coffee Mug", 24.99, "lifestyle", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=500&q=80"),
            ("Minimalist Watch", 189.99, "accessories", "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=500&q=80"),
            ("Desk Organizer", 45.00, "lifestyle", "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&w=500&q=80")
        ]
        c.executemany('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)', mock_products)

    conn.commit()
    conn.close()

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api_get()
        else:
            # Fallback for root route and normal HTML
            if self.path == '/':
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.handle_api_post()
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self.handle_api_delete()
        else:
            self.send_error(405, "Method Not Allowed")

    def _send_json(self, response_code, data):
        self.send_response(response_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_api_get(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/products":
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('SELECT id, name, price, category, image FROM products')
            rows = c.fetchall()
            products = [{"id": r[0], "name": r[1], "price": r[2], "category": r[3], "image": r[4]} for r in rows]
            conn.close()
            self._send_json(200, products)
        elif url.path == "/api/admin/dashboard":
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            
            c.execute('SELECT COUNT(*) FROM products')
            total_products = c.fetchone()[0]
            
            c.execute('SELECT COUNT(*) FROM users')
            total_users = c.fetchone()[0]
            
            c.execute('SELECT COUNT(*), SUM(total) FROM orders')
            order_stats = c.fetchone()
            total_orders = order_stats[0]
            total_revenue = order_stats[1] if order_stats[1] is not None else 0.0
            
            c.execute('''
                SELECT orders.id, users.email, orders.guest_email, orders.total, orders.address, orders.status,
                       payments.payment_method, payments.payment_contact, payments.status, orders.created_at
                FROM orders 
                LEFT JOIN users ON orders.user_id = users.id 
                LEFT JOIN payments ON orders.id = payments.order_id
                ORDER BY orders.id DESC LIMIT 30
            ''')
            orders_rows = c.fetchall()
            recent_orders = [{"id": r[0], "user_email": r[1] or r[2] or "Guest", "total": r[3], "address": r[4], "status": r[5], "payment_method": r[6], "payment_contact": r[7], "payment_status": r[8], "date": r[9]} for r in orders_rows]
            
            dashboard_data = {
                "total_products": total_products,
                "total_users": total_users,
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "recent_orders": recent_orders
            }
            conn.close()
            self._send_json(200, dashboard_data)
        elif url.path == "/api/users":
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('SELECT id, email, role FROM users ORDER BY id DESC')
            rows = c.fetchall()
            users = [{"id": r[0], "email": r[1], "role": r[2]} for r in rows]
            conn.close()
            self._send_json(200, users)
        elif url.path == "/api/user/dashboard":
            query = urllib.parse.parse_qs(url.query)
            email = query.get('email', [None])[0]
            if not email:
                return self._send_json(400, {"error": "Email required"})
            
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            
            c.execute('SELECT id FROM users WHERE email=?', (email,))
            user_row = c.fetchone()
            if not user_row:
                conn.close()
                return self._send_json(404, {"error": "User not found"})
            
            c.execute('''
                SELECT orders.id, orders.total, orders.address, orders.status, orders.created_at,
                       payments.payment_method, payments.payment_contact, payments.status
                FROM orders 
                LEFT JOIN payments ON orders.id = payments.order_id
                WHERE orders.user_id=? ORDER BY orders.id DESC
            ''', (user_id,))
            orders_rows = c.fetchall()
            orders = [{"id": r[0], "total": r[1], "address": r[2], "status": r[3], "date": r[4], "payment_method": r[5], "payment_contact": r[6], "payment_status": r[7]} for r in orders_rows]
            
            conn.close()
            self._send_json(200, {"orders": orders})
        else:
            self._send_json(404, {"error": "Not Found"})

    def handle_api_post(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        if not post_data:
            return self._send_json(400, {"error": "No data provided"})
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            return self._send_json(400, {"error": "Invalid JSON"})

        url = urllib.parse.urlparse(self.path)
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        try:
            if url.path == "/api/products": # Upload product
                image_base64 = data.get('image_base64')
                image_path = data.get('image', '')
                if image_base64:
                    uploads_dir = os.path.join(PUBLIC_DIR, 'assets', 'uploads')
                    os.makedirs(uploads_dir, exist_ok=True)
                    file_id = str(uuid.uuid4())
                    save_path = os.path.join(uploads_dir, f"{file_id}.jpg")
                    try:
                        if ',' in image_base64:
                            image_base64 = image_base64.split(',')[1]
                        with open(save_path, 'wb') as f:
                            f.write(base64.b64decode(image_base64))
                        image_path = f"/assets/uploads/{file_id}.jpg"
                    except Exception as e:
                        print("Error saving image:", e)
                
                # Fallback check
                if not image_path:
                    image_path = "/assets/mock-headphones.jpg"
                elif image_path.startswith('../'):
                    image_path = image_path[2:] # convert ../assets/... to /assets/...

                c.execute('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)',
                          (data.get('name'), data.get('price'), data.get('category'), image_path))
                conn.commit()
                self._send_json(201, {"message": "Product added successfully", "id": c.lastrowid})

            elif url.path == "/api/auth/register":
                email, password = data.get('email'), data.get('password')
                if not email.endswith('@gmail.com'):
                    return self._send_json(400, {"error": "Email must be a @gmail.com address."})
                if len(password) < 6 or len(password) > 8:
                    return self._send_json(400, {"error": "Password must be betweeen 6 and 8 characters."})
                if not password.isdigit():
                    return self._send_json(400, {"error": "Password must contain only numbers."})
                try:
                    c.execute('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', (email, password, 'pending'))
                    conn.commit()
                    self._send_json(200, {"message": "Registered successfully", "email": email})
                except sqlite3.IntegrityError:
                    self._send_json(400, {"error": "User already exists"})

            elif url.path == "/api/auth/login":
                email, password = data.get('email'), data.get('password')
                
                if not email.endswith('@gmail.com') and not email.endswith('@carfoon.com'):
                    return self._send_json(400, {"error": "Email must be a @gmail.com address."})
                if len(password) < 6 or len(password) > 8:
                    return self._send_json(400, {"error": "Password must be betweeen 6 and 8 characters."})
                if not password.isdigit() and not email.endswith('@carfoon.com'):
                    return self._send_json(400, {"error": "Password must contain only numbers."})

                c.execute('SELECT id, role FROM users WHERE email=? AND password=?', (email, password))
                user = c.fetchone()
                if user:
                    if user[1] == 'pending':
                        self._send_json(403, {"error": "Your account is awaiting Admin approval."})
                    else:
                        self._send_json(200, {"message": "Login successful", "email": email, "role": user[1]})
                else:
                    self._send_json(401, {"error": "Invalid credentials"})
            
            elif url.path == "/api/orders":
                email = data.get('email', 'guest@carfoon.com')
                c.execute('SELECT id FROM users WHERE email=?', (email,))
                user_row = c.fetchone()
                user_id = user_row[0] if user_row else None
                
                total = data.get('total')
                c.execute('INSERT INTO orders (user_id, guest_email, total, address) VALUES (?, ?, ?, ?)',
                          (user_id, email, total, data.get('address')))
                order_id = c.lastrowid
                
                payment_method = data.get('payment_method', 'Cash On Delivery')
                payment_contact = data.get('payment_contact', 'N/A')
                c.execute('INSERT INTO payments (order_id, amount, payment_method, payment_contact, status) VALUES (?, ?, ?, ?, ?)',
                          (order_id, total, payment_method, payment_contact, 'pending'))
                
                conn.commit()
                self._send_json(201, {"message": "Order completed successfully!"})
            
            elif url.path == "/api/users/role":
                user_id = data.get('id')
                new_role = data.get('role')
                if not user_id or not new_role:
                    return self._send_json(400, {"error": "Missing ID or Role"})
                c.execute('UPDATE users SET role=? WHERE id=?', (new_role, user_id))
                conn.commit()
                self._send_json(200, {"message": "Role updated"})
                
            elif url.path == "/api/users/create":
                email = data.get('email')
                password = data.get('password')
                role = data.get('role', 'user')
                if not email or not password:
                    return self._send_json(400, {"error": "Email and password are required"})
                try:
                    c.execute('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', (email, password, role))
                    conn.commit()
                    self._send_json(201, {"message": "User created successfully", "id": c.lastrowid})
                except sqlite3.IntegrityError:
                    self._send_json(400, {"error": "User email already exists"})
                
            elif url.path == "/api/orders/update_status":
                order_id = data.get('id')
                new_status = data.get('status')
                if not order_id or not new_status:
                    return self._send_json(400, {"error": "Missing ID or Status"})
                c.execute('UPDATE orders SET status=? WHERE id=?', (new_status, order_id))
                conn.commit()
                self._send_json(200, {"message": "Status updated"})
                
            elif url.path == "/api/orders/update_payment":
                order_id = data.get('id')
                new_status = data.get('payment_status')
                if not order_id or not new_status:
                    return self._send_json(400, {"error": "Missing ID or Status"})
                c.execute('UPDATE payments SET status=? WHERE order_id=?', (new_status, order_id))
                conn.commit()
                self._send_json(200, {"message": "Payment Status updated"})
                
            elif url.path == "/api/users/update_profile":
                email = data.get('email')
                new_email = data.get('new_email')
                new_password = data.get('new_password')
                
                if not email:
                    return self._send_json(400, {"error": "Current email required"})
                    
                update_fields = []
                update_vals = []
                if new_email:
                    update_fields.append("email=?")
                    update_vals.append(new_email)
                if new_password:
                    update_fields.append("password=?")
                    update_vals.append(new_password)
                    
                if not update_fields:
                    return self._send_json(400, {"error": "No update data provided"})
                
                update_vals.append(email)
                
                query_str = f"UPDATE users SET {', '.join(update_fields)} WHERE email=?"
                try:
                    c.execute(query_str, tuple(update_vals))
                    conn.commit()
                    self._send_json(200, {"message": "Profile updated successfully"})
                except sqlite3.IntegrityError:
                    self._send_json(400, {"error": "Email already in use"})
            else:
                self._send_json(404, {"error": "API route not found"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})
        finally:
            conn.close()

    def handle_api_delete(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        if not post_data:
            return self._send_json(400, {"error": "No data provided"})
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            return self._send_json(400, {"error": "Invalid JSON"})

        url = urllib.parse.urlparse(self.path)
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        try:
            if url.path == "/api/products":
                product_id = data.get('id')
                if not product_id:
                    return self._send_json(400, {"error": "Product ID required"})
                c.execute('DELETE FROM products WHERE id=?', (product_id,))
                conn.commit()
                if c.rowcount > 0:
                    self._send_json(200, {"message": "Product deleted successfully"})
                else:
                    self._send_json(404, {"error": "Product not found"})
            elif url.path == "/api/orders":
                order_id = data.get('id')
                if not order_id:
                    return self._send_json(400, {"error": "Order ID required"})
                c.execute('DELETE FROM orders WHERE id=?', (order_id,))
                if c.rowcount > 0:
                    c.execute('DELETE FROM payments WHERE order_id=?', (order_id,))
                    c.execute('DELETE FROM order_items WHERE order_id=?', (order_id,))
                    conn.commit()
                    self._send_json(200, {"message": "Order deleted successfully"})
                else:
                    self._send_json(404, {"error": "Order not found"})
            else:
                self._send_json(404, {"error": "API route not found"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})
        finally:
            conn.close()

if __name__ == "__main__":
    init_db()
    # Use ThreadingTCPServer for concurrent request handling and allow address reuse
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        print(f"Backend & Static Server running at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
