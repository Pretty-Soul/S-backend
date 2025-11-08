const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
// No longer need crypto or emailSender

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;

            // --- Password Constraint Check ---
            if (!password || password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long." });
            }

            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { 
                return res.status(409).json({ message: "Email already exists." }); 
            }
            
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            // Save the user (set as verified by default)
            await db.collection('users').insertOne({ 
                name, 
                email, 
                password: hashedPassword, 
                addresses: [],
                isEmailVerified: true // Set to true by default
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

    router.post('/admin/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });
            if (!user || user.role !== 'admin') { return res.status(401).json({ message: "Invalid admin credentials." }); }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid admin credentials." }); }
            res.status(200).json({ message: "Admin login successful!", user: { name: user.name, email: user.email, role: 'admin' } });
        } catch (err) {
            console.error("Error in /admin/login:", err);
            res.status(500).json({ message: "Error logging in as admin." });
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

    // --- PRODUCT ROUTES ---
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
            const productId = req.params.id;
            if (!ObjectId.isValid(productId)) {
                 return res.status(400).json({ message: "Invalid product ID format." });
            }
            const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
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

    router.post('/categories', async (req, res) => {
        console.log("Received request for ADMIN POST /categories");
        try {
            const { name } = req.body;
            if (!name) return res.status(400).json({ message: "Category name required." });
            const existing = await db.collection('categories').findOne({ name: name });
            if (existing) return res.status(409).json({ message: "Category already exists." });
            await db.collection('categories').insertOne({ name });
            res.status(201).json({ message: "Category added." });
        } catch (err) {
            console.error("Error adding category (admin):", err);
            res.status(500).json({ message: "Error adding category." });
        }
    });

    router.delete('/categories/:name', async (req, res) => {
        console.log(`Received request for ADMIN DELETE /categories/${req.params.name}`);
        try {
            const categoryName = decodeURIComponent(req.params.name);
            const result = await db.collection('categories').deleteOne({ name: categoryName });
            if (result.deletedCount === 0) return res.status(404).json({ message: "Category not found." });
            res.status(200).json({ message: "Category deleted." });
        } catch (err) {
            console.error("Error deleting category (admin):", err);
            res.status(500).json({ message: "Error deleting category." });
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

    router.post('/cart/update', async (req, res) => {
        console.log("Received request for POST /cart/update");
        try {
            const { userEmail, productId, quantity, productName, price } = req.body;
            let cart = await db.collection('carts').findOne({ userEmail });
            if (!cart) { cart = { userEmail, items: [] }; }
            const itemIndex = cart.items.findIndex(item => item.productId === productId);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity;
                if (cart.items[itemIndex].quantity <= 0) {
                    cart.items.splice(itemIndex, 1);
                }
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

    // --- FINAL CHECKOUT ROUTE ---
    // --- FINAL CHECKOUT ROUTE (CORRECTED WITH TRANSACTION) ---
    router.post('/checkout', async (req, res) => {
        console.log("Received request for POST /checkout (Transactional)");
        const session = db.client.startSession(); // Start a MongoDB Client Session
        
        try {
            session.startTransaction(); // Begin the transaction
            
            const { userEmail, shippingAddress, shippingMethod, totalAmount } = req.body;
            
            // Fetch cart using the current session
            const cart = await db.collection('carts').findOne({ userEmail }, { session });
            if (!cart || cart.items.length === 0) { 
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: "Cart is empty." }); 
            }
            
            // 1. STOCK VALIDATION AND DEDUCTION LOOP
            for (const item of cart.items) {
                // Assuming your cart item structure for productId includes the product's _id-variationIndex
                const parts = item.productId.split('-');
                const realProductIdString = parts[0];
                const variationIndex = parseInt(parts[1], 10) || 0; // Default to index 0 if not present

                if (!ObjectId.isValid(realProductIdString)) { 
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Invalid product ID format in cart.` }); 
                }
                const realProductId = new ObjectId(realProductIdString);
                
                // Fetch product for stock check (within the transaction)
                const product = await db.collection('products').findOne({ _id: realProductId }, { session });

                if (!product || !product.variations || !product.variations[variationIndex]) { 
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Product variation not found for ${item.name}.` }); 
                }

                const currentStock = product.variations[variationIndex].stock;
                
                // Stock Check: Ensure there is enough stock
                if (currentStock < item.quantity) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Not enough stock for ${item.name}. Only ${currentStock} remaining.` });
                }

                // STOCK DEDUCTION: Use $inc to decrease stock
                // Note: We use the dynamic index from the cart item
                const updatePath = `variations.${variationIndex}.stock`;
                
                const updateResult = await db.collection('products').updateOne(
                    { _id: realProductId, [updatePath]: { $gte: item.quantity } }, // Ensure stock is still available
                    { $inc: { [updatePath]: -item.quantity } },
                    { session } // Pass the session here!
                );

                // Important check: If the update didn't match any documents, something is wrong
                if (updateResult.matchedCount === 0) {
                    // This often means a race condition where stock was sold out between read and update
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ message: `Stock update failed for ${item.name}. It may have just sold out.` });
                }
            }
            
            // 2. ORDER INSERTION (Within the transaction)
            const order = { userEmail, items: cart.items, totalAmount: totalAmount, shippingAddress, shippingMethod, orderDate: new Date() };
            const insertResult = await db.collection('orders').insertOne(order, { session });
            
            // 3. CART DELETION (Clear the cart in the database - Within the transaction)
            await db.collection('carts').deleteOne({ userEmail }, { session });
            
            // 4. COMMIT the transaction (All or nothing)
            await session.commitTransaction();
            
            // 5. Clean up the session
            session.endSession();

            // 6. Respond to the client
            const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId });
            res.status(200).json({ message: "Order placed successfully!", order: newOrder });

        } catch (err) {
            console.error("Error in /checkout (ABORTING TRANSACTION):", err);
            // Abort the transaction if any error occurred
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
            res.status(500).json({ message: "Error during checkout. Transaction aborted.", details: err.message });
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

    // --- ADMIN PRODUCT ROUTES ---
     router.post('/products', async (req, res) => { /* ... */ });
     router.put('/products/:id', async (req, res) => { /* ... */ });
     router.delete('/products/:id', async (req, res) => { /* ... */ });
     router.post('/categories', async (req, res) => { /* ... */ });
     router.delete('/categories/:name', async (req, res) => { /* ... */ });

    // Return the configured router
    return router;
};
