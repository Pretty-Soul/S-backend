const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- PUBLIC AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            if (!password || password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long." });
            }
            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { 
                return res.status(409).json({ message: "Email already exists." }); 
            }
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await db.collection('users').insertOne({ 
                name, 
                email, 
                password: hashedPassword, 
                addresses: [],
                isEmailVerified: true,
                role: 'customer' // Default role
            });
            res.status(201).json({ message: "User created successfully! Please log in." });
        } catch (err) {
            console.error("Error in /signup:", err);
            res.status(500).json({ message: "Error creating user." });
        }
    });

    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });
            if (!user) { return res.status(401).json({ message: "Invalid credentials." }); }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid credentials." }); }
            res.status(200).json({ message: "Login successful!", user: { name: user.name, email: user.email } });
        } catch (err) {
            console.error("Error in /login:", err);
            res.status(500).json({ message: "Error logging in." });
        }
    });

    // --- PUBLIC USER PROFILE & ADDRESS ROUTES ---
    // (All your /user/... routes remain here)
    router.get('/user/addresses/:email', async (req, res) => { /* ... */ });
    router.post('/user/addresses', async (req, res) => { /* ... */ });
    router.put('/user/addresses/:addressId', async (req, res) => { /* ... */ });
    router.delete('/user/addresses/:addressId', async (req, res) => { /* ... */ });
    router.get('/user/profile/:email', async (req, res) => { /* ... */ });
    router.put('/user/profile', async (req, res) => { /* ... */ });


    // --- PUBLIC PRODUCT ROUTES ---
    // (Both customer AND admin panel use these to VIEW data)
    router.get('/products', async (req, res) => {
        console.log("Received request for GET /products");
        try {
            const products = await db.collection('products').find({}).sort({ name: 1 }).toArray();
            res.status(200).json(products);
        } catch (err) {
            console.error("Error fetching products:", err);
            res.status(500).json({ message: "Error fetching products." });
        }
    });

    router.get('/products/suggestions', async (req, res) => { /* ... */ });
    router.get('/products/:id', async (req, res) => { /* ... */ });

    // --- PUBLIC CATEGORY ROUTES ---
    // (Both customer AND admin panel use these to VIEW data)
    router.get('/categories', async (req, res) => {
        console.log("Received request for GET /categories");
        try {
            const categories = await db.collection('categories').find({}).toArray();
            res.status(200).json(categories);
        } catch (err) {
            console.error("Error fetching categories:", err);
            res.status(500).json({ message: "Error fetching categories." });
        }
    });

    // --- OTHER PUBLIC ROUTES ---
    router.get('/testimonials', async (req, res) => { /* ... */ });
    router.get('/cart/:email', async (req, res) => { /* ... */ });
    router.post('/cart/update', async (req, res) => { /* ... */ });
    router.post('/checkout', async (req, res) => { /* ... */ });
    router.get('/orders/:email', async (req, res) => { /* ... */ });
    router.get('/search', async (req, res) => { /* ... */ });
    
    // Return the configured router
    return router;
};