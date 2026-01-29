import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Creating sample SQLite databases...\n');

// ============================================
// Database 1: Products Database
// ============================================
const productsDbPath = path.join(dataDir, 'products.db');

// Remove existing database if it exists
if (fs.existsSync(productsDbPath)) {
  fs.unlinkSync(productsDbPath);
}

const productsDb = new Database(productsDbPath);

// Create tables
productsDb.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    sku TEXT UNIQUE,
    category_id INTEGER,
    stock_quantity INTEGER DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    reviewer_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Insert sample categories
const insertCategory = productsDb.prepare(`
  INSERT INTO categories (name, description, slug) VALUES (?, ?, ?)
`);

const categories = [
  ['Electronics', 'Electronic devices and gadgets', 'electronics'],
  ['Clothing', 'Apparel and fashion items', 'clothing'],
  ['Books', 'Books and publications', 'books'],
  ['Home & Garden', 'Home improvement and garden supplies', 'home-garden'],
  ['Sports', 'Sports equipment and accessories', 'sports'],
];

categories.forEach(([name, desc, slug]) => {
  insertCategory.run(name, desc, slug);
});

// Insert sample products
const insertProduct = productsDb.prepare(`
  INSERT INTO products (name, description, price, sku, category_id, stock_quantity, image_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const products = [
  ['Wireless Bluetooth Headphones', 'Premium noise-canceling headphones with 30-hour battery life', 149.99, 'WBH-001', 1, 150, 'https://example.com/headphones.jpg'],
  ['Smart Watch Pro', 'Advanced fitness tracking with heart rate monitor', 299.99, 'SWP-002', 1, 75, 'https://example.com/smartwatch.jpg'],
  ['USB-C Hub 7-in-1', 'Multi-port adapter for laptops', 49.99, 'UCH-003', 1, 200, 'https://example.com/usbhub.jpg'],
  ['Cotton T-Shirt Classic', 'Comfortable 100% cotton t-shirt', 24.99, 'CTS-001', 2, 500, 'https://example.com/tshirt.jpg'],
  ['Denim Jeans Slim Fit', 'Modern slim fit jeans', 79.99, 'DJS-002', 2, 250, 'https://example.com/jeans.jpg'],
  ['Winter Jacket', 'Warm insulated jacket for cold weather', 189.99, 'WJK-003', 2, 100, 'https://example.com/jacket.jpg'],
  ['JavaScript: The Good Parts', 'Classic programming book by Douglas Crockford', 29.99, 'BJS-001', 3, 80, 'https://example.com/jsbook.jpg'],
  ['Clean Code', 'A handbook of agile software craftsmanship', 44.99, 'BCC-002', 3, 120, 'https://example.com/cleancode.jpg'],
  ['Garden Tool Set', '5-piece stainless steel garden tools', 59.99, 'GTS-001', 4, 60, 'https://example.com/gardentools.jpg'],
  ['LED Desk Lamp', 'Adjustable brightness desk lamp', 39.99, 'LDL-002', 4, 180, 'https://example.com/desklamp.jpg'],
  ['Yoga Mat Premium', 'Non-slip exercise yoga mat', 34.99, 'YMP-001', 5, 300, 'https://example.com/yogamat.jpg'],
  ['Resistance Bands Set', '5-level resistance bands for workouts', 19.99, 'RBS-002', 5, 400, 'https://example.com/resistancebands.jpg'],
];

products.forEach(([name, desc, price, sku, catId, stock, img]) => {
  insertProduct.run(name, desc, price, sku, catId, stock, img);
});

// Insert sample reviews
const insertReview = productsDb.prepare(`
  INSERT INTO product_reviews (product_id, rating, title, comment, reviewer_name)
  VALUES (?, ?, ?, ?, ?)
`);

const reviews = [
  [1, 5, 'Amazing sound quality!', 'Best headphones I ever owned. The noise cancellation is incredible.', 'John D.'],
  [1, 4, 'Great but pricey', 'Excellent audio quality, but a bit expensive for casual listeners.', 'Sarah M.'],
  [2, 5, 'Perfect for fitness', 'Tracks everything accurately and battery lasts forever!', 'Mike R.'],
  [4, 4, 'Comfortable fit', 'Nice quality cotton and true to size.', 'Emily W.'],
  [7, 5, 'Must read for JS developers', 'Changed how I write JavaScript code.', 'David L.'],
  [8, 5, 'Life-changing book', 'Every developer should read this book.', 'Anna K.'],
];

reviews.forEach(([productId, rating, title, comment, reviewer]) => {
  insertReview.run(productId, rating, title, comment, reviewer);
});

productsDb.close();
console.log(`✓ Created: ${productsDbPath}`);
console.log('  - categories: 5 rows');
console.log('  - products: 12 rows');
console.log('  - product_reviews: 6 rows\n');

// ============================================
// Database 2: Customers Database
// ============================================
const customersDbPath = path.join(dataDir, 'customers.db');

// Remove existing database if it exists
if (fs.existsSync(customersDbPath)) {
  fs.unlinkSync(customersDbPath);
}

const customersDb = new Database(customersDbPath);

// Create tables
customersDb.exec(`
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'USA',
    postal_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    shipping_address TEXT,
    notes TEXT,
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    shipped_at DATETIME,
    delivered_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

// Insert sample customers
const insertCustomer = customersDb.prepare(`
  INSERT INTO customers (email, first_name, last_name, phone, address, city, country, postal_code)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const customers = [
  ['john.doe@email.com', 'John', 'Doe', '555-0101', '123 Main St', 'New York', 'USA', '10001'],
  ['jane.smith@email.com', 'Jane', 'Smith', '555-0102', '456 Oak Ave', 'Los Angeles', 'USA', '90001'],
  ['bob.wilson@email.com', 'Bob', 'Wilson', '555-0103', '789 Pine Rd', 'Chicago', 'USA', '60601'],
  ['alice.johnson@email.com', 'Alice', 'Johnson', '555-0104', '321 Elm St', 'Houston', 'USA', '77001'],
  ['charlie.brown@email.com', 'Charlie', 'Brown', '555-0105', '654 Maple Dr', 'Phoenix', 'USA', '85001'],
  ['diana.ross@email.com', 'Diana', 'Ross', '555-0106', '987 Cedar Ln', 'Philadelphia', 'USA', '19101'],
  ['edward.king@email.com', 'Edward', 'King', '555-0107', '147 Birch Way', 'San Antonio', 'USA', '78201'],
  ['fiona.green@email.com', 'Fiona', 'Green', '555-0108', '258 Walnut St', 'San Diego', 'USA', '92101'],
];

customers.forEach(([email, first, last, phone, addr, city, country, postal]) => {
  insertCustomer.run(email, first, last, phone, addr, city, country, postal);
});

// Insert sample orders
const insertOrder = customersDb.prepare(`
  INSERT INTO orders (customer_id, order_number, status, total_amount, shipping_address, ordered_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', ?))
`);

const orders = [
  [1, 'ORD-2024-001', 'delivered', 199.98, '123 Main St, New York, NY 10001', '-30 days'],
  [1, 'ORD-2024-002', 'shipped', 79.99, '123 Main St, New York, NY 10001', '-5 days'],
  [2, 'ORD-2024-003', 'delivered', 329.97, '456 Oak Ave, Los Angeles, CA 90001', '-20 days'],
  [3, 'ORD-2024-004', 'processing', 149.99, '789 Pine Rd, Chicago, IL 60601', '-2 days'],
  [4, 'ORD-2024-005', 'pending', 54.98, '321 Elm St, Houston, TX 77001', '-1 days'],
  [5, 'ORD-2024-006', 'delivered', 224.98, '654 Maple Dr, Phoenix, AZ 85001', '-15 days'],
  [6, 'ORD-2024-007', 'shipped', 44.99, '987 Cedar Ln, Philadelphia, PA 19101', '-3 days'],
  [2, 'ORD-2024-008', 'delivered', 189.99, '456 Oak Ave, Los Angeles, CA 90001', '-45 days'],
];

orders.forEach(([custId, orderNum, status, total, addr, daysAgo]) => {
  insertOrder.run(custId, orderNum, status, total, addr, daysAgo);
});

// Insert sample order items
const insertOrderItem = customersDb.prepare(`
  INSERT INTO order_items (order_id, product_name, product_sku, quantity, unit_price, total_price)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const orderItems = [
  [1, 'Wireless Bluetooth Headphones', 'WBH-001', 1, 149.99, 149.99],
  [1, 'USB-C Hub 7-in-1', 'UCH-003', 1, 49.99, 49.99],
  [2, 'Denim Jeans Slim Fit', 'DJS-002', 1, 79.99, 79.99],
  [3, 'Smart Watch Pro', 'SWP-002', 1, 299.99, 299.99],
  [3, 'Cotton T-Shirt Classic', 'CTS-001', 1, 24.99, 24.99],
  [4, 'Wireless Bluetooth Headphones', 'WBH-001', 1, 149.99, 149.99],
  [5, 'Cotton T-Shirt Classic', 'CTS-001', 2, 24.99, 49.98],
  [6, 'Winter Jacket', 'WJK-003', 1, 189.99, 189.99],
  [6, 'Yoga Mat Premium', 'YMP-001', 1, 34.99, 34.99],
  [7, 'JavaScript: The Good Parts', 'BJS-001', 1, 29.99, 29.99],
  [7, 'Resistance Bands Set', 'RBS-002', 1, 19.99, 19.99],
  [8, 'Winter Jacket', 'WJK-003', 1, 189.99, 189.99],
];

orderItems.forEach(([orderId, name, sku, qty, unitPrice, totalPrice]) => {
  insertOrderItem.run(orderId, name, sku, qty, unitPrice, totalPrice);
});

customersDb.close();
console.log(`✓ Created: ${customersDbPath}`);
console.log('  - customers: 8 rows');
console.log('  - orders: 8 rows');
console.log('  - order_items: 12 rows\n');

console.log('============================================');
console.log('Sample SQLite databases created successfully!');
console.log('============================================\n');
console.log('You can now add these as data sources in SyncEngine:');
console.log(`  - Products DB: ./data/products.db`);
console.log(`  - Customers DB: ./data/customers.db`);
