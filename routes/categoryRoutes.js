const express = require('express');
const router = express.Router();

module.exports = function(db) {

    // GET all categories
    router.get('/categories', async (req, res) => {
        try {
            const categories = await db.collection('categories').find({}).toArray();
            res.status(200).json(categories);
        } catch (err) {
            console.error("Error fetching categories:", err);
            res.status(500).json({ message: "Error fetching categories." });
        }
    });

    // You can add other category-related routes here in the future
    // (e.g., POST to add a new category, DELETE to remove one)

    return router;
};