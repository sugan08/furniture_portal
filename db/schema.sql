-- Online Furniture Rental Portal Database Schema
CREATE DATABASE IF NOT EXISTS furniture_rental_db;
USE furniture_rental_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    image_url TEXT
);

-- Furniture Items Table
CREATE TABLE IF NOT EXISTS furniture_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    monthly_rate DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2) NOT NULL,
    dimensions VARCHAR(100),
    material VARCHAR(100),
    stock_quantity INT DEFAULT 5,
    image_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Rentals Table
CREATE TABLE IF NOT EXISTS rentals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rental_code VARCHAR(20) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    tenure_months INT NOT NULL DEFAULT 3,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_rent_total DECIMAL(10,2) NOT NULL,
    security_deposit_total DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'active', 'returned', 'cancelled') DEFAULT 'pending',
    delivery_address TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rental Items Detail Table
CREATE TABLE IF NOT EXISTS rental_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    furniture_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    monthly_rate DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE,
    FOREIGN KEY (furniture_id) REFERENCES furniture_items(id) ON DELETE CASCADE
);
