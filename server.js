import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


import authRoutes from "./routes/auth.js";
import invoiceRoutes from "./routes/invoice.js";


dotenv.config();


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));


app.use(
session({
secret: process.env.SESSION_SECRET || "secret123",
resave: false,
saveUninitialized: true,
})
);


// ROUTES
app.use("/auth", authRoutes);
app.use("/invoice", invoiceRoutes);


app.get("/", (req, res) => {
res.send("Shopify GST Invoice App is running.");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
