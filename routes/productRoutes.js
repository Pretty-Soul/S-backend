const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

module.exports = function(db) {

    // Get all products
    router.get('/products', async (req, res) => {
        try {
            const products = await db.collection('products').find({}).sort({ name: 1 }).toArray();
            res.status(200).json(products);
        } catch (err) { res.status(500).json({ message: "Error fetching products." }); }
    });

    // --- MOVED UP: More specific routes must come before general ones ---
    // Get live search suggestions
    router.get('/products/suggestions', async (req, res) => {
        try {
            const query = req.query.q;
            if (!query) {
                return res.json([]);
            }
            const suggestions = await db.collection('products')
                .find({ name: { $regex: query, $options: 'i' } })
                .project({ name: 1, _id: 0 })
                .limit(5)
                .toArray();
            res.status(200).json(suggestions);
        } catch (err) {
            console.error("Error in /products/suggestions:", err);
            res.status(500).json({ message: "Error fetching suggestions." });
        }
    });

    // Get a single product by its ID
    router.get('/products/:id', async (req, res) => {
        try {
            const productId = req.params.id;
            const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });

            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }
            res.status(200).json(product);
        } catch (err) {
            console.error("Error in /products/:id route:", err);
            res.status(500).json({ message: "Error fetching single product." });
        }
    });

    // --- Admin Routes ---

    // Add a new product
    router.post('/products', async (req, res) => {
        try {
            const newProduct = req.body;
            if (!newProduct.name || !newProduct.variations || !newProduct.images) {
                return res.status(400).json({ message: "Missing required product fields." });
            }
            const result = await db.collection('products').insertOne(newProduct);
            res.status(201).json(result);
        } catch (err) { res.status(500).json({ message: "Error adding product." }); }
    });

   // Replace your old PUT /products/:id route with this one
router.put('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const updatedData = req.body; // This will contain the fields to update (e.g., name, variations)

        // Ensure the _id field is not part of the update data
        delete updatedData._id;

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(productId) },
            { $set: updatedData }
        );
        res.status(200).json(result);
    } catch (err) { 
        console.error("Error updating product:", err);
        res.status(500).json({ message: "Error updating product." }); 
    }
});

    // Delete a product
    router.delete('/products/:id', async (req, res) => {
        try {
            const productId = req.params.id;
            const result = await db.collection('products').deleteOne({ _id: new ObjectId(productId) });
            res.status(200).json(result);
        } catch (err) { res.status(500).json({ message: "Error deleting product." }); }
    });

    return router;
};