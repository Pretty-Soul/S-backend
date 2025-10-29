const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // Needed for secure token generation
const { sendVerificationEmail } = require('../utils/emailSender'); // Ensure this path is correct

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            let user = await db.collection('users').findOne({ email: email });

            // Generate Verification Token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // Token expires in 1 hour

            // Construct Verification Link (Use your *frontend* URL here)
            const frontendUrl = process.env.FRONTEND_URL || 'https://68e665f10a949a000819c14c--susegad-supplies.netlify.app'; // Get from .env or default
            const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

            if (user && !user.isEmailVerified) {
                // User exists but isn't verified - update token and resend email
                await db.collection('users').updateOne(
                    { email: email },
                    { $set: { emailVerificationToken: verificationToken, emailVerificationTokenExpires: expiryDate } }
                );
                await sendVerificationEmail(email, verificationLink); // Send the LINK now
                return res.status(200).json({ message: "Account exists but wasn't verified. New verification link sent to your email." });

            } else if (user) {
                return res.status(409).json({ message: "Email already exists and is verified." });
            }

            // --- If user does NOT exist, create them ---
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            await db.collection('users').insertOne({
                name, email, password: hashedPassword, addresses: [],
                isEmailVerified: false,
                emailVerificationToken: verificationToken, // Store the token
                emailVerificationTokenExpires: expiryDate  // Store expiry
            });

            const emailSent = await sendVerificationEmail(email, verificationLink); // Send the LINK now
            if (!emailSent) {
                console.error(`Failed to send verification email to ${email}, but user was created.`);
                return res.status(201).json({ message: "User created, but failed to send verification email. Please try verifying later or contact support." });
            }

            res.status(201).json({ message: "User created! Please check your email for a verification link." });
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

            // *** Prevent login if email isn't verified ***
            if (!user.isEmailVerified) {
                 return res.status(403).json({
                     message: "Please verify your email address first. Check your inbox for the verification link.",
                     needsVerification: true, // Keep this flag
                     email: user.email
                 });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid credentials." }); }
            res.status(200).json({ message: "Login successful!", user: { name: user.name, email: user.email } });
        } catch (err) {
            console.error("Error in /login:", err);
            res.status(500).json({ message: "Error logging in." });
        }
    });

    // --- NEW EMAIL VERIFICATION ROUTE (Handles the Link Click) ---
    router.post('/verify-email-link', async (req, res) => {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ message: "Verification token is missing." });
            }

            // Find user by the token
            const user = await db.collection('users').findOne({
                emailVerificationToken: token,
                // Check if token hasn't expired
                emailVerificationTokenExpires: { $gt: new Date() }
            });

            if (!user) {
                // Could be invalid token OR expired token
                return res.status(400).json({ message: "Verification link is invalid or has expired." });
            }

            // Verification successful! Update user document
            await db.collection('users').updateOne(
                { _id: user._id }, // Use user's _id for update
                { $set: { isEmailVerified: true }, $unset: { emailVerificationToken: "", emailVerificationTokenExpires: "" } }
            );

            res.status(200).json({ message: "Email verified successfully! You can now log in." });

        } catch (err) {
            console.error("Error verifying email link:", err);
            res.status(500).json({ message: "Error verifying email." });
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
            const userEmail = req.body.userEmail; // Or req.user.email if using auth middleware
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
        console.log("Received request for GET /products (from shopRoutes)");
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
        console.log("Received request for GET /categories (from shopRoutes)");
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
         // Add auth check here
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
         // Add auth check here
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

    router.post('/checkout', async (req, res) => {
        console.log("Received request for POST /checkout");
        try {
            const { userEmail, shippingAddress, shippingMethod } = req.body;
            const cart = await db.collection('carts').findOne({ userEmail });
            if (!cart || cart.items.length === 0) { return res.status(400).json({ message: "Cart is empty." }); }
            
            for (const item of cart.items) {
                const realProductIdString = item.productId.split('-')[0];
                if (!ObjectId.isValid(realProductIdString)) { return res.status(400).json({ message: `Invalid product ID format found in cart for item ${item.name}` }); }
                const realProductId = new ObjectId(realProductIdString);
                const product = await db.collection('products').findOne({ _id: realProductId });
                if (!product) { return res.status(400).json({ message: `Product not found for ${item.name}.` }); }
            }
            
            const totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const order = { userEmail, items: cart.items, totalAmount, shippingAddress, shippingMethod, orderDate: new Date() };
            const insertResult = await db.collection('orders').insertOne(order);
            await db.collection('carts').deleteOne({ userEmail });
            
            const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId });
            res.status(200).json({ message: "Order placed successfully!", order: newOrder });
        } catch (err) {
            console.error("Error in /checkout:", err);
            res.status(500).json({ message: "Error during checkout." });
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
    
    // --- ADMIN PRODUCT ROUTES (simplified example - needs role check middleware ideally) ---
     router.post('/products', async (req, res) => {
         console.log("Received request for ADMIN POST /products");
         // Add auth check here
         try {
             const newProduct = req.body;
             if (!newProduct.name || !newProduct.variations || !newProduct.images) { return res.status(400).json({ message: "Missing required product fields." }); }
             const result = await db.collection('products').insertOne(newProduct);
             res.status(201).json(result);
         } catch (err) {
              console.error("Error adding product (admin):", err);
              res.status(500).json({ message: "Error adding product." });
         }
     });

    router.put('/products/:id', async (req, res) => {
         console.log(`Received request for ADMIN PUT /products/${req.params.id}`);
         // Add auth check here
        try {
            const productId = req.params.id;
             if (!ObjectId.isValid(productId)) { return res.status(400).json({ message: "Invalid product ID format." }); }
            const updatedData = req.body;
            delete updatedData._id;
            const result = await db.collection('products').updateOne({ _id: new ObjectId(productId) }, { $set: updatedData });
             if (result.matchedCount === 0) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(result);
        } catch (err) {
             console.error("Error updating product (admin):", err);
             res.status(500).json({ message: "Error updating product." });
        }
    });

    router.delete('/products/:id', async (req, res) => {
         console.log(`Received request for ADMIN DELETE /products/${req.params.id}`);
         // Add auth check here
        try {
            const productId = req.params.id;
             if (!ObjectId.isValid(productId)) { return res.status(400).json({ message: "Invalid product ID format." }); }
            const result = await db.collection('products').deleteOne({ _id: new ObjectId(productId) });
             if (result.deletedCount === 0) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(result);
        } catch (err) {
             console.error("Error deleting product (admin):", err);
             res.status(500).json({ message: "Error deleting product." });
        }
    });

    // Return the configured router
    return router;
};