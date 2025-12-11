import axios from "axios";

export async function getOrderDetails(orderId) {
  // Use consistent environment variable names
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const shopName = process.env.SHOP_NAME;

  if (!token || !shopName) {
    throw new Error("Missing SHOPIFY_ACCESS_TOKEN or SHOP_NAME environment variables");
  }

  try {
    const response = await axios.get(
      `https://${shopName}/admin/api/2024-10/orders/${orderId}.json`,
      {
        headers: { 
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.order;
    
  } catch (error) {
    console.error("Shopify API Error:", error.response?.data || error.message);
    throw new Error(`Failed to fetch order ${orderId}: ${error.response?.data?.errors || error.message}`);
  }
}
