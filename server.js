import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

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

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const APP_URL = process.env.APP_URL;
const SCOPES = "read_orders,write_orders,read_products,write_products";

// OAuth Routes
app.get('/install', (req, res) => {
    const shop = req.query.shop;
    if (!shop) {
        return res.status(400).send('Missing shop parameter. Usage: /install?shop=your-store.myshopify.com');
    }
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${APP_URL}/callback`;
    res.redirect(installUrl);
});

app.get('/callback', async (req, res) => {
    const { shop, code } = req.query;

    if (!shop || !code) {
        return res.status(400).send('Missing shop or code');
    }

    try {
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: API_KEY,
            client_secret: API_SECRET,
            code: code
        });

        const accessToken = response.data.access_token;

        console.log('------------------------------------------------');
        console.log(`SUCCESS! Access Token for ${shop}:`);
        console.log(accessToken); 
        console.log('Add this to Railway Variables as SHOPIFY_ACCESS_TOKEN');
        console.log('Add shop as SHOP_NAME =', shop);
        console.log('------------------------------------------------');

        // Redirect to app home after successful installation
        res.redirect(`https://${shop}/admin/apps/${API_KEY}`);

    } catch (error) {
        console.error('Error getting token:', error.response ? error.response.data : error.message);
        res.status(500).send('Error during handshake. Check logs.');
    }
});

// NEW: Embedded App Home Page
app.get('/app', (req, res) => {
    const shop = req.query.shop || process.env.SHOP_NAME;
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GST Invoice Generator</title>
    <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background: #f6f6f7;
        }
        .card {
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #202223;
            margin-top: 0;
        }
        .info {
            background: #f1f2f4;
            padding: 16px;
            border-radius: 4px;
            margin: 16px 0;
        }
        .button {
            background: #008060;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        .button:hover {
            background: #006e52;
        }
        .status {
            padding: 8px 12px;
            border-radius: 4px;
            display: inline-block;
            font-size: 14px;
        }
        .status.success {
            background: #d4f4dd;
            color: #008060;
        }
        .instructions {
            line-height: 1.6;
        }
        .instructions ol {
            padding-left: 20px;
        }
        .instructions li {
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>🧾 GST Invoice Generator</h1>
        <div class="status success">✓ App Successfully Installed</div>
        
        <div class="info">
            <h3>How to Generate an Invoice:</h3>
            <div class="instructions">
                <ol>
                    <li>Go to <strong>Orders</strong> in your Shopify admin</li>
                    <li>Click on any order</li>
                    <li>Click <strong>"More actions"</strong> at the top right</li>
                    <li>Select <strong>"Generate GST Invoice"</strong></li>
                </ol>
            </div>
        </div>

        <div class="info">
            <h3>📋 Current Configuration:</h3>
            <p><strong>Shop:</strong> ${shop}</p>
            <p><strong>Status:</strong> Ready to generate invoices</p>
        </div>

        <button class="button" onclick="testInvoice()">Test Invoice Generation</button>
    </div>

    <script>
        const apiKey = '${API_KEY}';
        const shopOrigin = '${shop}';
        
        // Initialize Shopify App Bridge
        const AppBridge = window['app-bridge'];
        const createApp = AppBridge.default;
        const app = createApp({
            apiKey: apiKey,
            host: new URLSearchParams(window.location.search).get('host') || btoa(shopOrigin + '/admin'),
        });

        function testInvoice() {
            alert('To generate an invoice:\\n\\n1. Go to Orders\\n2. Open any order\\n3. Click "More actions"\\n4. Select "Generate GST Invoice"');
        }
    </script>
</body>
</html>
    `);
});

// EXISTING ROUTES
app.use("/auth", authRoutes);
app.use("/invoice", invoiceRoutes);

app.get("/", (req, res) => {
  res.send("Shopify GST Invoice App is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
