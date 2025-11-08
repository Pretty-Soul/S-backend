const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

module.exports = function (db) {
    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            if (!password || password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long." });
            }

            const existingUser = await db.collection('users').findOne({ email });
            if (existingUser) return res.status(409).json({ message: "Email already exists." });

            const hashedPassword = await bcrypt.hash(password, 10);
            await db.collection('users').insertOne({
                name,
                email,
                password: hashedPassword,
                addresses: [],
                isEmailVerified: true
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
            const user = await db.collection('users').findOne({ email });
            if (!user) return res.status(401).json({ message: "Invalid credentials." });

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) return res.status(401).json({ message: "Invalid credentials." });

            res.status(200).json({ message: "Login successful!", user: { name: user.name, email: user.email } });
        } catch (err) {
            console.error("Error in /login:", err);
            res.status(500).json({ message: "Error logging in." });
        }
    });

    // --- PRODUCT ROUTES ---
    router.get('/products', async (req, res) => {
        try {
            const products = await db.collection('products').find({}).sort({ name: 1 }).toArray();
            res.status(200).json(products);
        } catch (err) {
            console.error("Error fetching products:", err);
            res.status(500).json({ message: "Error fetching products." });
        }
    });

    router.get('/products/:id', async (req, res) => {
        try {
            const productId = req.params.id;
            if (!ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product ID format." });
            const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
            if (!product) return res.status(404).json({ message: "Product not found" });
            res.status(200).json(product);
        } catch (err) {
            console.error("Error in /products/:id route:", err);
            res.status(500).json({ message: "Error fetching single product." });
        }
    });

    // --- CART ROUTES ---
    router.get('/cart/:email', async (req, res) => {
        try {
            const userEmail = req.params.email;
            let cart = await db.collection('carts').findOne({ userEmail });
            if (!cart) cart = { userEmail, items: [] };
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/:email:", err);
            res.status(500).json({ message: "Error fetching cart." });
        }
    });

    router.post('/cart/update', async (req, res) => {
        try {
            const { userEmail, productId, quantity, productName, price } = req.body;
            let cart = await db.collection('carts').findOne({ userEmail });
            if (!cart) cart = { userEmail, items: [] };

            const index = cart.items.findIndex(item => item.productId === productId);
            if (index > -1) {
                cart.items[index].quantity += quantity;
                if (cart.items[index].quantity <= 0) cart.items.splice(index, 1);
            } else if (quantity > 0) {
                cart.items.push({ productId, name: productName, price, quantity });
            }

            await db.collection('carts').updateOne({ userEmail }, { $set: { items: cart.items } }, { upsert: true });
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/update:", err);
            res.status(500).json({ message: "Error updating cart." });
        }
    });

    // --- ✅ FIXED FINAL CHECKOUT ROUTE ---
    router.post('/checkout', async (req, res) => {
        console.log("Received request for POST /checkout");
        try {
            const { userEmail, shippingAddress, shippingMethod, totalAmount } = req.body;
            const cart = await db.collection('carts').findOne({ userEmail });

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ message: "Cart is empty." });
            }

            // STOCK VALIDATION AND DEDUCTION
            for (const item of cart.items) {
                const realProductIdString = item.productId.split('-')[0];
                if (!ObjectId.isValid(realProductIdString)) {
                    return res.status(400).json({ message: "Invalid product ID format." });
                }

                const realProductId = new ObjectId(realProductIdString);
                const product = await db.collection('products').findOne({ _id: realProductId });

                if (!product) {
                    return res.status(400).json({ message: `Product not found for ${item.name}.` });
                }

                const currentStock = product.variations?.[0]?.stock ?? 0;
                if (currentStock < item.quantity) {
                    return res.status(400).json({ message: `Not enough stock for ${item.name}.` });
                }

                // Deduct stock safely
                await db.collection('products').updateOne(
                    { _id: realProductId },
                    { $inc: { "variations.0.stock": -item.quantity } }
                );
            }

            // CREATE ORDER
            const order = {
                userEmail,
                items: cart.items,
                totalAmount,
                shippingAddress,
                shippingMethod,
                orderDate: new Date(),
            };
            const insertResult = await db.collection('orders').insertOne(order);
            const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId });

            // CLEAR CART
            await db.collection('carts').deleteOne({ userEmail });

            // ✅ Return full order for confirmation
            res.status(200).json({ order: newOrder });
        } catch (err) {
            console.error("Error in /checkout:", err);
            res.status(500).json({ message: "Error during checkout." });
        }
    });

    router.get('/orders/:email', async (req, res) => {
        try {
            const orders = await db.collection('orders')
                .find({ userEmail: req.params.email })
                .sort({ orderDate: -1 })
                .toArray();
            res.status(200).json(orders);
        } catch (err) {
            console.error("Error in /orders/:email:", err);
            res.status(500).json({ message: "Error fetching order history." });
        }
    });

    return router;
};
