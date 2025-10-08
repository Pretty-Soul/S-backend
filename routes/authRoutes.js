const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = function(db) {
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { return res.status(409).json({ message: "Email already exists." }); }
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            // New users are created without a role by default
            await db.collection('users').insertOne({ name, email, password: hashedPassword });
            res.status(201).json({ message: "User created successfully!" });
        } catch (err) { res.status(500).json({ message: "Error creating user." }); }
    });

    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });
            if (!user) { return res.status(401).json({ message: "Invalid credentials." }); }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid credentials." }); }
            
            // UPDATED: Include the user's role in the successful login response
            res.status(200).json({ 
                message: "Login successful!", 
                user: { 
                    name: user.name, 
                    email: user.email, 
                    role: user.role || 'user' // Default to 'user' if role is not set
                } 
            });
        } catch (err) { res.status(500).json({ message: "Error logging in." }); }
    });
    // --- NEW: This is for ADMIN login only ---
    router.post('/admin/login', async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await db.collection('users').findOne({ email: email });

            // Security Check: User must exist AND have the 'admin' role
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ message: "Access Denied. Not an admin." });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(403).json({ message: "Invalid credentials." });
            }
            
            res.status(200).json({ 
                message: "Admin login successful!", 
                user: { 
                    name: user.name, 
                    email: user.email, 
                    role: user.role
                } 
            });
        } catch (err) { 
            res.status(500).json({ message: "Error logging in." }); 
        }
    });

    return router;
};