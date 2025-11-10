// routes/adminRoutes.js
import express from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";

const router = express.Router();

export default function (db) {
  // --- ADMIN LOGIN ---
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await db.collection("users").findOne({ email });
      if (!user) return res.status(401).json({ message: "Invalid admin credentials." });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid admin credentials." });

      if (user.role !== "admin")
        return res.status(403).json({ message: "Access denied. Not an admin." });

      res.status(200).json({
        message: "Admin login successful!",
        user: { name: user.name, email: user.email, role: "admin" },
      });
    } catch (err) {
      console.error("Error in /admin/login:", err);
      res.status(500).json({ message: "Error logging in as admin." });
    }
  });

  // --- PRODUCTS ---
  router.post("/products", async (req, res) => {
    try {
      const newProduct = req.body;
      const result = await db.collection("products").insertOne(newProduct);
      res.status(201).json({ message: "Product added successfully", id: result.insertedId });
    } catch (err) {
      console.error("Error adding product:", err);
      res.status(500).json({ message: "Error adding product." });
    }
  });

  router.put("/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).json({ message: "Invalid product ID." });

      const result = await db.collection("products").updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body }
      );

      if (result.matchedCount === 0)
        return res.status(404).json({ message: "Product not found." });

      res.status(200).json({ message: "Product updated successfully." });
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ message: "Error updating product." });
    }
  });

  router.delete("/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).json({ message: "Invalid product ID." });

      const result = await db.collection("products").deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0)
        return res.status(404).json({ message: "Product not found." });

      res.status(200).json({ message: "Product deleted successfully." });
    } catch (err) {
      console.error("Error deleting product:", err);
      res.status(500).json({ message: "Error deleting product." });
    }
  });

  // --- CATEGORIES ---
  router.post("/categories", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Category name is required." });

      const exists = await db.collection("categories").findOne({ name });
      if (exists)
        return res.status(409).json({ message: "Category already exists." });

      await db.collection("categories").insertOne({ name });
      res.status(201).json({ message: "Category added successfully." });
    } catch (err) {
      console.error("Error adding category:", err);
      res.status(500).json({ message: "Error adding category." });
    }
  });

  router.delete("/categories/:name", async (req, res) => {
    try {
      const categoryName = decodeURIComponent(req.params.name);
      const result = await db.collection("categories").deleteOne({ name: categoryName });
      if (result.deletedCount === 0)
        return res.status(404).json({ message: "Category not found." });

      res.status(200).json({ message: "Category deleted successfully." });
    } catch (err) {
      console.error("Error deleting category:", err);
      res.status(500).json({ message: "Error deleting category." });
    }
  });

  return router;
}
