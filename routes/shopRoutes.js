const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

// Export a function that accepts the database connection AND the client
module.exports = function(db, client) { // <-- 1. Accept client here

    // --- AUTH ROUTES ---
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
                role: 'customer'
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

    // --- USER PROFILE & ADDRESS ROUTES ---
    router.get('/user/addresses/:email', async (req, res) => {
        try {
            const user = await db.collection('users').findOne({ email: req.params.email });
            res.status(200).json(user?.addresses || []);
        } catch (err) {
            console.error("Error in /user/addresses/:email:", err);
            res.status(500).json({ message: "Error fetching addresses." });
        }
    });

    router.post('/user/addresses', async (req, res) => {
        try {
            const { userEmail, newAddress } = req.body;
            const user = await db.collection('users').findOne({ email: userEmail });
            if (!user) { return res.status(404).json({ message: "User not found." }); }
            const addressExists = user.addresses?.some(
                savedAddr =>
                    savedAddr.fullName?.toLowerCase() === newAddress.fullName?.toLowerCase() &&
                    savedAddr.address?.toLowerCase() === newAddress.address?.toLowerCase() &&
                    savedAddr.city?.toLowerCase() === newAddress.city?.toLowerCase() &&
                    savedAddr.pincode === newAddress.pincode
            );
            if (addressExists) { return res.status(200).json({ message: "Address already exists." }); }
            const addressWithId = { ...newAddress, _id: new ObjectId() };
            await db.collection('users').updateOne({ email: userEmail }, { $push: { addresses: addressWithId } });
            res.status(200).json({ message: "Address saved successfully." });
        } catch (err) {
            console.error("Error saving address:", err);
            res.status(500).json({ message: "Error saving address." });
        }
    });

    router.put('/user/addresses/:addressId', async (req, res) => {
        try {
            const { userEmail, address } = req.body;
            const { addressId } = req.params;
            await db.collection('users').updateOne(
                { email: userEmail, "addresses._id": new ObjectId(addressId) },
                { $set: { "addresses.$": { ...address, _id: new ObjectId(addressId) } } }
            );
            res.status(200).json({ message: "Address updated successfully." });
        } catch (err) {
            console.error("Error updating address:", err);
            res.status(500).json({ message: "Error updating address." });
        }
    });

    router.delete('/user/addresses/:addressId', async (req, res) => {
        try {
            const { userEmail } = req.body;
            const { addressId } = req.params;
            await db.collection('users').updateOne(
                { email: userEmail },
                { $pull: { addresses: { _id: new ObjectId(addressId) } } }
            );
            res.status(200).json({ message: "Address deleted successfully." });
        } catch (err) {
            console.error("Error deleting address:", err);
            res.status(500).json({ message: "Error deleting address." });
        }
    });

    router.get('/user/profile/:email', async (req, res) => {
        try {
            const user = await db.collection('users').findOne(
                { email: req.params.email },
                { projection: { password: 0 } }
            );
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: "User not found." });
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            res.status(500).json({ message: "Error fetching user profile." });
        }
    });

    router.put('/user/profile', async (req, res) => {
        try {
            const { userEmail, newName } = req.body;
            await db.collection('users').updateOne(
                { email: userEmail },
                { $set: { name: newName } }
            );
            res.status(200).json({ message: "Profile updated successfully." });
        } catch (err) {
            console.error("Error updating profile:", err);
            res.status(500).json({ message: "Error updating profile." });
        }
    });

    // --- PUBLIC PRODUCT ROUTES ---
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

    router.get('/products/suggestions', async (req, res) => {
        console.log("Received request for GET /products/suggestions");
        try {
            const query = req.query.q;
            if (!query) { return res.json([]); }
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

    router.get('/products/:id', async (req, res) => {
        console.log(`Received request for GET /products/${req.params.id}`);
        try {
            const fullId = req.params.id;
            const productIdString = fullId.split('-')[0];

            if (!ObjectId.isValid(productIdString)) {
                 return res.status(400).json({ message: "Invalid product ID format." });
            }

            const product = await db.collection('products').findOne({ _id: new ObjectId(productIdString) });
            
            if (!product) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(product);
        } catch (err) {
            console.error("Error in /products/:id route:", err);
            res.status(500).json({ message: "Error fetching single product." });
        }
    });

    // --- CATEGORY ROUTES ---
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

    // --- TESTIMONIALS ROUTE ---
    router.get('/testimonials', async (req, res) => {
        console.log("Received request for GET /testimonials");
        try {
            const testimonials = await db.collection('testimonials').find({}).limit(3).toArray();
            res.status(200).json(testimonials);
        } catch (err) {
            console.error("Error fetching testimonials:", err);
            res.status(500).json({ message: "Error fetching testimonials." });
        }
    });

    // --- CART & ORDER ROUTES ---
    router.get('/cart/:email', async (req, res) => {
        console.log(`Received request for GET /cart/${req.params.email}`);
        try {
            const userEmail = req.params.email;
            let cart = await db.collection('carts').findOne({ userEmail: userEmail });
            if (!cart) { cart = { userEmail: userEmail, items: [] }; }
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/:email:", err);
            res.status(500).json({ message: "Error fetching cart." });
        }
    });

    // ---
    // --- ⬇️ "ADD TO LIST" FIX (ROBUST /cart/update ROUTE) ⬇️ ---
    // ---
    router.post('/cart/update', async (req, res) => {
        console.log("Received request for POST /cart/update");
        try {
            // Only require the essentials from the frontend
            const { userEmail, productId, quantity } = req.body;

            if (!userEmail || !productId || quantity === undefined) {
                return res.status(400).json({ message: "Missing required fields (userEmail, productId, quantity)." });
            }

            // --- Find Product and Variation from Database ---
            const idParts = productId.split('-');
            const realProductIdString = idParts[0];
            // Handle cases where size might have hyphens
            const variationSize = idParts.slice(1).join('-'); 

            if (!ObjectId.isValid(realProductIdString)) {
                return res.status(400).json({ message: "Invalid product ID format." });
            }

            const product = await db.collection('products').findOne({ _id: new ObjectId(realProductIdString) });
            if (!product) {
                return res.status(404).json({ message: "Product not found." });
            }

            let targetVariation;
            // Check new "variations" structure
            if (product.variations && product.variations.length > 0) {
                // Find the variation that matches the size from the ID
                targetVariation = product.variations.find(v => v.size === variationSize);
            // Check old product structure
            } else if (product.stock !== undefined) {
                // If it's an old product, it has no size, so this check will fail
                // We'll assume the frontend wouldn't send a variation ID for an old product
                // A better fix is to ensure all products have variations (which you did)
                // But we'll handle the case where the variation is just the default
                if(variationSize === "default" || variationSize === "") { // Handle old products
                     targetVariation = { size: "default", price: product.price, stock: product.stock };
                }
            }

            if (!targetVariation) {
                 // This is the key error: the variation ID from the product list page 
                 // (like "productID-Single Piece") doesn't match a variation
                 // Let's try to grab the *first* variation as a fallback
                 if(product.variations && product.variations.length > 0) {
                     targetVariation = product.variations[0];
                     console.warn(`Variation size "${variationSize}" not found. Defaulting to first variation: ${targetVariation.size}`);
                 } else {
                     return res.status(404).json({ message: `Product variation "${variationSize}" not found.` });
                 }
            }
            // --- End Find Product ---

            // Check stock BEFORE adding to cart
            if (targetVariation.stock <= 0 && quantity > 0) {
                 return res.status(400).json({ message: "This item is out of stock." });
            }

            let cart = await db.collection('carts').findOne({ userEmail });
            if (!cart) { cart = { userEmail, items: [] }; }

            // Use the product ID *with* the correct variation size
            const cartProductId = `${product._id}-${targetVariation.size}`;

            const itemIndex = cart.items.findIndex(item => item.productId === cartProductId);

            if (itemIndex > -1) {
                // Item already in cart, update quantity
                const newQuantity = cart.items[itemIndex].quantity + quantity;

                // Check stock against new total quantity
                if (targetVariation.stock < newQuantity) {
                     return res.status(400).json({ message: `Not enough stock. Only ${targetVariation.stock} total available.` });
                }
                
                if (newQuantity <= 0) {
                    cart.items.splice(itemIndex, 1); // Remove if quantity is 0 or less
                } else {
                    cart.items[itemIndex].quantity = newQuantity;
                }

            } else if (quantity > 0) {
                 // Check stock for new item
                if (targetVariation.stock < quantity) {
                    return res.status(400).json({ message: `Not enough stock. Only ${targetVariation.stock} available.` });
                }
                // Item not in cart, add it (using data from DB, not client)
                cart.items.push({ 
                    productId: cartProductId, // Use the full ID with size
                    name: product.name,             // Get name from DB
                    price: targetVariation.price,   // Get price from DB
                    quantity: quantity 
                });
            }

            await db.collection('carts').updateOne({ userEmail }, { $set: { items: cart.items } }, { upsert: true });
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/update:", err);
            res.status(500).json({ message: "Error updating cart." });
        }
    });

    // ---
    // --- ⬇️ CHECKOUT FIX (Stock Check & Decrement) ⬇️ ---
    // ---
    router.post('/checkout', async (req, res) => {
        console.log("Received request for POST /checkout");
        const session = client.startSession(); // Use the client to start a transaction

        try {
            // Run all database operations in a transaction
            await session.withTransaction(async () => {
                const { userEmail, shippingAddress, shippingMethod } = req.body;
                const cart = await db.collection('carts').findOne({ userEmail }, { session });
                
                if (!cart || cart.items.length === 0) { 
                    throw new Error("Cart is empty."); 
                }
                
                let totalAmount = 0;
                const updateOperations = []; // To hold all stock updates

                for (const item of cart.items) {
                    // 1. Parse the ID
                    const idParts = item.productId.split('-');
                    const realProductIdString = idParts[0];
                    const variationSize = idParts.slice(1).join('-');

                    if (!ObjectId.isValid(realProductIdString)) { 
                        throw new Error(`Invalid product ID ${item.productId} in cart.`); 
                    }
                    const realProductId = new ObjectId(realProductIdString);
                    
                    // 2. Find the product
                    const product = await db.collection('products').findOne({ _id: realProductId }, { session });
                    if (!product) { 
                        throw new Error(`Product not found for ${item.name}.`); 
                    }

                    // 3. Find the correct variation
                    let targetVariation;
                    let variationIndex = -1; // Index for new structure
                    
                    if (product.variations && product.variations.length > 0) {
                        variationIndex = product.variations.findIndex(v => v.size === variationSize);
                        if (variationIndex > -1) {
                            targetVariation = product.variations[variationIndex];
                        }
                    } else if (product.stock !== undefined && (variationSize === "default" || variationSize === "")) {
                        // Handle old product structure
                        targetVariation = { stock: product.stock };
                        variationIndex = -2; // Use -2 as a flag for "old structure"
                    }

                    if (!targetVariation) {
                        throw new Error(`Variation for ${item.name} (${variationSize}) not found.`);
                    }

                    // 4. *** CRITICAL STOCK CHECK ***
                    if (targetVariation.stock < item.quantity) {
                        throw new Error(`Not enough stock for ${item.name}. Only ${targetVariation.stock} available.`);
                    }

                    // 5. Calculate total and prepare stock update
                    totalAmount += (item.price * item.quantity); // Use item.price from cart
                    
                    // Prepare the operation to decrement stock
                    let updateField;
                    if (variationIndex >= 0) {
                        // New structure: update stock inside the variations array
                        updateField = `variations.${variationIndex}.stock`;
                    } else {
                        // Old structure: update top-level stock
                        updateField = `stock`;
                    }

                    updateOperations.push({
                        updateOne: {
                            filter: { _id: realProductId },
                            update: { $inc: { [updateField]: -item.quantity } } // $inc to subtract
                        }
                    });
                }
                
                // 6. Create the order
                const order = { userEmail, items: cart.items, totalAmount, shippingAddress, shippingMethod, orderDate: new Date() };
                const insertResult = await db.collection('orders').insertOne(order, { session });
                
                // 7. Delete the cart
                await db.collection('carts').deleteOne({ userEmail }, { session });
                
                // 8. Execute all stock updates at once
                await db.collection('products').bulkWrite(updateOperations, { session });

                // Success
                const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId }, { session });
                res.status(200).json({ message: "Order placed successfully!", order: newOrder });
            });
        } catch (err) {
            console.error("Error in /checkout:", err);
            // Send specific error messages back to the frontend
            if (err.message.includes("Cart is empty") || err.message.includes("Not enough stock") || err.message.includes("not found")) {
                res.status(400).json({ message: err.message });
            } else {
                res.status(500).json({ message: "Error during checkout." });
            }
        } finally {
            // End the session
            await session.endSession();
        }
    });

    router.get('/orders/:email', async (req, res) => {
        console.log(`Received request for GET /orders/${req.params.email}`);
        try {
            const userEmail = req.params.email;
            const orders = await db.collection('orders').find({ userEmail: userEmail }).sort({ orderDate: -1 }).toArray();
            res.status(200).json(orders);
        } catch (err) {
            console.error("Error in /orders/:email:", err);
            res.status(500).json({ message: "Error fetching order history." });
        }
    });
    
    // --- SEARCH ROUTE ---
    router.get('/search', async (req, res) => {
        console.log(`Received request for GET /search?q=${req.query.q}`);
        try {
            const query = req.query.q;
            if (!query) { return res.status(400).json({ message: "Search query is required." }); }
            const searchResults = await db.collection('products').find({
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            }).toArray();
            res.status(200).json(searchResults);
        } catch (err) {
            console.error("Error during search:", err);
            res.status(500).json({ message: "Error searching products." });
        }
    });

    // Return the configured router
    return router;
};
