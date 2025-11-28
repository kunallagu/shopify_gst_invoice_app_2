import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios"; // <--- ADDED: Needed for the token exchange

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

// ============================================================
// START: NEW SHOPIFY OAUTH CODE
// ============================================================
const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const APP_URL = process.env.APP_URL; // Your Railway URL (No trailing slash)
// Update scopes if you need more permissions later
const SCOPES = "read_orders,read_products,write_products"; 

// 1. Install Route: Starts the login
app.get('/install', (req, res) => {
    const shop = req.query.shop;
    if (!shop) {
        return res.status(400).send('Missing shop parameter. Usage: /install?shop=your-store.myshopify.com');
    }
    // Build the authorization URL
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${APP_URL}/callback`;
    
    console.log(`Redirecting to Shopify Login: ${installUrl}`);
    res.redirect(installUrl);
});

// 2. Callback Route: Gets the token
app.get('/callback', async (req, res) => {
    const { shop, code } = req.query;

    if (!shop || !code) {
        return res.status(400).send('Missing shop or code');
    }

    try {
        // Exchange the temporary code for the Permanent Access Token
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: API_KEY,
            client_secret: API_SECRET,
            code: code
        });

        const accessToken = response.data.access_token;

        console.log('------------------------------------------------');
        console.log(`SUCCESS! Your Access Token for ${shop}:`);
        console.log(accessToken); 
        console.log('------------------------------------------------');

        res.send(`<h1>Success!</h1><p>The Access Token has been printed in your Railway Deploy Logs.</p>`);

    } catch (error) {
        console.error('Error getting token:', error.response ? error.response.data : error.message);
        res.status(500).send('Error during handshake. Check logs.');
    }
});
// ============================================================
// END: NEW SHOPIFY OAUTH CODE
// ============================================================

// EXISTING ROUTES
app.use("/auth", authRoutes);
app.use("/invoice", invoiceRoutes);

app.get("/", (req, res) => {
  res.send("Shopify GST Invoice App is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));