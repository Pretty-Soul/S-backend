const express = require('express');
const router = express.Router();

module.exports = function(db) {
    // Get all categories
    router.get('/categories', async (req, res) => {
        try {
            const categoriesCollection = db.collection('categories');
            if (await categoriesCollection.countDocuments() === 0) {
                await categoriesCollection.insertMany([
                    { name: "Local Goan Drinks" }, { name: "Sweets & Desserts" },
                    { name: "Spices & Masalas" }, { name: "Bakery & Breads" },
                    { name: "Pickles & Preserves" }
                ]);
            }
            const categories = await categoriesCollection.find({}).sort({ name: 1 }).toArray();
            res.status(200).json(categories);
        } catch (err) { res.status(500).json({ message: "Error fetching categories." }); }
    });

    // Add a new category
    router.post('/categories', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) { return res.status(400).json({ message: "Category name is required." }); }
            const existingCategory = await db.collection('categories').findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
            if (existingCategory) { return res.status(409).json({ message: "Category already exists." }); }
            const result = await db.collection('categories').insertOne({ name });
            res.status(201).json(result);
        } catch (err) { res.status(500).json({ message: "Error adding category." }); }
    });

    // Delete a category
    router.delete('/categories/:name', async (req, res) => {
        try {
            const categoryName = req.params.name;
            const productCount = await db.collection('products').countDocuments({ category: categoryName });
            if (productCount > 0) {
                return res.status(400).json({ message: `Cannot delete category. ${productCount} product(s) still use it.` });
            }
            const result = await db.collection('categories').deleteOne({ name: categoryName });
            res.status(200).json(result);
        } catch (err) {
            res.status(500).json({ message: "Error deleting category." });
        }
    });

    return router;
};