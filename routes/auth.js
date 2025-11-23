import express from "express";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();
const router = express.Router();
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = "read_orders,write_orders";
const REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URL;
// STEP 1 — INSTALL REDIRECT
router.get("/install", (req, res) => {
const installUrl = `https://${SHOPIFY_DOMAIN}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${REDIRECT_URI}`;
res.redirect(installUrl);
});
// STEP 2 — OAUTH CALLBACK
router.get("/callback", async (req, res) => {
const { code } = req.query;
try {
const tokenResponse = await axios.post(
`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`,
{
client_id: SHOPIFY_API_KEY,
client_secret: SHOPIFY_API_SECRET,
code,
}
);
req.session.accessToken = tokenResponse.data.access_token;
res.send("App installed successfully! You can now generate invoices.");
} catch (err) {
console.error(err.response?.data || err);
res.status(500).send("OAuth failed");
}
});
export default router;
