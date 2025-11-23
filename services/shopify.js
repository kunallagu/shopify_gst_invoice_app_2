import axios from "axios";

export async function getOrderDetails(orderId) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;

  const response = await axios.get(
    `https://${domain}/admin/api/2024-01/orders/${orderId}.json`,
    {
      headers: { "X-Shopify-Access-Token": token }
    }
  );

  return response.data.order;
}
