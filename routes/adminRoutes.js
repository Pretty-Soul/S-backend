const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- ADMIN AUTH ---
    // Note: The URL is now /admin/login
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });

            if (!user) { return res.status(401).json({ message: "Invalid admin credentials." }); }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid admin credentials." }); }
            if (user.role !== 'admin') {
                return res.status(403).json({ message: "Access denied. Not an admin." });
            }
            res.status(200).json({ message: "Admin login successful!", user: { name: user.name, email: user.email, role: 'admin' } });
        } catch (err) {
            console.error("Error in /admin/login:", err);
            res.status(500).json({ message: "Error logging in as admin." });
        }
    });

    // --- ADMIN PRODUCT ROUTES ---

    // ADD A NEW PRODUCT
    // Note: The URL is now /admin/products
    router.post('/products', async (req, res) => {
        try {
            const newProduct = req.body;
            const result = await db.collection('products').insertOne(newProduct);
            res.status(201).json({ message: "Product added successfully", insertedId: result.insertedId });
        } catch (err) {
            console.error("Error in ADMIN POST /products:", err);
            res.status(500).json({ message: "Error adding product." });
        }
    });

    // UPDATE A PRODUCT
    // Note: The URL is now /admin/products/:id
    router.put('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid product ID format." });
            }
            const updateData = req.body; 
            const result = await db.collection('products').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData } 
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Product not found." });
            }
            res.status(200).json({ message: "Product updated successfully." });
        } catch (err) {
            console.error("Error in ADMIN PUT /products/:id:", err);
            res.status(500).json({ message: "Error updating product." });
        }
    });

    // DELETE A PRODUCT
    // Note: The URL is now /admin/products/:id
    router.delete('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid product ID format." });
            }
            const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Product not found." });
            }
            res.status(200).json({ message: "Product deleted successfully." });
        } catch (err) {
            console.error("Error in ADMIN DELETE /products/:id:", err);
            res.status(500).json({ message: "Error deleting product." });
        }
    });

    // --- ADMIN CATEGORY ROUTES ---

    // ADD A NEW CATEGORY
    // Note: The URL is now /admin/categories
    router.post('/categories', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ message: "Category name is required." });
            }
            const existingCategory = await db.collection('categories').findOne({ name: name });
            if (existingCategory) {
                return res.status(409).json({ message: "Category already exists." });
            }
            await db.collection('categories').insertOne({ name: name });
            res.status(201).json({ message: "Category added successfully." });
        } catch (err) {
            console.error("Error in ADMIN POST /categories:", err);
            res.status(500).json({ message: "Error adding category." });
        }
    });

    // DELETE A CATEGORY
    // Note: The URL is now /admin/categories/:name
    router.delete('/categories/:name', async (req, res) => {
        try {
            const categoryName = decodeURIComponent(req.params.name);
            const result = await db.collection('categories').deleteOne({ name: categoryName });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Category not found." });
            }
            res.status(200).json({ message: "Category deleted successfully." });
        } catch (err) {
            console.error("Error in ADMIN DELETE /categories/:name:", err);
            res.status(500).json({ message: "Error deleting category." });
        }
    });

    // Return the configured router
    return router;
};