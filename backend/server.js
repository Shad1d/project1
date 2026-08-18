import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import dns from "dns";
import helmet from "helmet";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);


const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "ecommerce-secret-key";

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use("/api/cart", cartRoutes);
app.use("/uploads", express.static("uploads"));

// ── Security headers ───────────────────────────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false, // adjust when you add a frontend SSR layer
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
const products = [
  {
    id: 1,
    name: "Wireless Headphones",
    category: "Audio",
    price: 129.99,
    stock: 15,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    description: "Premium wireless headphones with noise cancellation.",
  },
  {
    id: 2,
    name: "Smart Watch",
    category: "Wearables",
    price: 199.99,
    stock: 10,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
    description: "Track health, workouts, and notifications on the go.",
  },
  {
    id: 3,
    name: "Gaming Keyboard",
    category: "Accessories",
    price: 89.99,
    stock: 20,
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae",
    description: "Mechanical RGB keyboard for smooth gaming sessions.",
  },
];

const users = [];
const carts = {};
const orders = [];

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

const createToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized. Missing token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Ecommerce API is running." });
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the ecommerce backend." });
});

app.get("/api/products", (req, res) => {
  res.json({ products });
});

app.get("/api/products/:id", (req, res) => {
  const product = products.find((item) => item.id === Number(req.params.id));

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  res.json({ product });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const userExists = users.find((user) => user.email === email);

  if (userExists) {
    return res.status(409).json({ message: "User already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now(),
    name,
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  const token = createToken(newUser);

  res.status(201).json({
    message: "User registered successfully.",
    token,
    user: sanitizeUser(newUser),
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = users.find((item) => item.email === email);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Incorrect password." });
  }

  const token = createToken(user);

  res.json({
    message: "Login successful.",
    token,
    user: sanitizeUser(user),
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = users.find((item) => item.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ user: sanitizeUser(user) });
});

app.get("/api/cart", authMiddleware, (req, res) => {
  const userCart = carts[req.user.id] || { items: [] };

  res.json({ cart: userCart });
});

app.post("/api/cart/add", authMiddleware, (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json({ message: "productId is required." });
  }

  const product = products.find((item) => item.id === Number(productId));

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const userCart = carts[req.user.id] || { items: [] };
  const existingItem = userCart.items.find((item) => item.productId === Number(productId));

  if (existingItem) {
    existingItem.quantity += Number(quantity);
  } else {
    userCart.items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: Number(quantity),
    });
  }

  carts[req.user.id] = userCart;

  res.status(201).json({
    message: "Product added to cart.",
    cart: userCart,
  });
});

app.put("/api/cart/update", authMiddleware, (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ message: "productId and quantity are required." });
  }

  const userCart = carts[req.user.id];

  if (!userCart) {
    return res.status(404).json({ message: "Cart not found." });
  }

  const item = userCart.items.find((entry) => entry.productId === Number(productId));

  if (!item) {
    return res.status(404).json({ message: "Item not in cart." });
  }

  item.quantity = Number(quantity);

  res.json({ message: "Cart updated.", cart: userCart });
});

app.delete("/api/cart/remove", authMiddleware, (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ message: "productId is required." });
  }

  const userCart = carts[req.user.id];

  if (!userCart) {
    return res.status(404).json({ message: "Cart not found." });
  }

  userCart.items = userCart.items.filter((item) => item.productId !== Number(productId));

  res.json({ message: "Item removed from cart.", cart: userCart });
});

app.post("/api/orders/checkout", authMiddleware, (req, res) => {
  const userCart = carts[req.user.id] || { items: [] };

  if (!userCart.items.length) {
    return res.status(400).json({ message: "Your cart is empty." });
  }

  const total = userCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = {
    id: `ORD-${Date.now()}`,
    userId: req.user.id,
    items: userCart.items,
    total: Number(total.toFixed(2)),
    status: "Paid",
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  carts[req.user.id] = { items: [] };

  res.status(201).json({
    message: "Order placed successfully.",
    order,
  });
});

app.get("/api/orders", authMiddleware, (req, res) => {
  const userOrders = orders.filter((order) => order.userId === req.user.id);

  res.json({ orders: userOrders });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

app.use("/api/listings", listingRoutes);

await pool();
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});