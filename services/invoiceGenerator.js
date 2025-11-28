import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core"; // <--- FIX: Changed to -core
import chromium from "chrome-aws-lambda"; // <--- FIX: Added for serverless path
import { getOrderDetails } from "./shopify.js";

export async function generateInvoicePDF(orderId) {
  const order = await getOrderDetails(orderId);

  const billing = order.billing_address || {};
  const shipping = order.shipping_address || {};

  const grandTotal = parseFloat(order.total_price || 0);
  let grossAmount = 0;
  let itemsHTML = "";

  order.line_items.forEach((item) => {
    const price = parseFloat(item.price || 0);
    const lineAmount = price * item.quantity;
    grossAmount += lineAmount;

    itemsHTML += `
      <tr>
        <td>${item.sku || "-"}</td>
        <td>${item.title}</td>
        <td>${item.quantity}</td>
        <td>${price.toFixed(2)}</td>
        <td>${lineAmount.toFixed(2)}</td>
      </tr>
    `;
  });

  let discountAmount = grossAmount - grandTotal;
  if (discountAmount < 0) discountAmount = 0;

  const netAmount = grossAmount - discountAmount;
  const taxableValue = netAmount / 1.03;
  const totalTax = taxableValue * 0.03;

  const supplierState = "Maharashtra";
  const supplierStateCode = "MH";

  let cgst = 0,
    sgst = 0,
    igst = 0;

  if (
    shipping.province === supplierState ||
    shipping.province_code === supplierStateCode
  ) {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  } else {
    igst = totalTax;
  }

  const round = (x) => x.toFixed(2);

  const customerGSTIN =
    (billing.gstin && String(billing.gstin).trim()) || "";

  const invoiceType = customerGSTIN ? "B2B" : "B2C";

  let billToBlock = `
    ${billing.first_name || ""} ${billing.last_name || ""}<br>
    ${billing.phone || "—"}<br>
    ${billing.address1 || ""}<br>
    ${billing.city || ""}, ${billing.province || ""}, ${billing.zip || ""}<br>
  `;

  if (customerGSTIN) {
    billToBlock += `GSTIN: ${customerGSTIN}<br>`;
  }

  let shipToBlock = `
    ${shipping.first_name || ""} ${shipping.last_name || ""}<br>
    ${shipping.phone || "—"}<br>
    ${shipping.address1 || ""}<br>
    ${shipping.city || ""}, ${shipping.province || ""}, ${shipping.zip || ""}<br>
  `;

  const invoiceDateObj = new Date(order.created_at);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const formattedDate = `${String(invoiceDateObj.getDate()).padStart(
    2,
    "0"
  )}-${months[invoiceDateObj.getMonth()]}-${invoiceDateObj.getFullYear()}`;

  const templatePath = path.resolve("templates/invoice.html");
  let html = fs.readFileSync(templatePath, "utf8");

  html = html
    .replace(/{{invoice_number}}/g, order.name)
    .replace(/{{invoice_date}}/g, formattedDate)
    .replace(/{{bill_to_block}}/g, billToBlock)
    .replace(/{{ship_to_block}}/g, shipToBlock)
    .replace(/{{place_of_supply}}/g, shipping.province || "—")
    .replace(/{{invoice_type}}/g, invoiceType)
    .replace(/{{items}}/g, itemsHTML)
    .replace(/{{gross_amount}}/g, round(grossAmount))
    .replace(/{{discount_value}}/g, round(discountAmount))
    .replace(/{{net_amount}}/g, round(netAmount))
    .replace(/{{taxable_value}}/g, round(taxableValue))
    .replace(/{{cgst}}/g, round(cgst))
    .replace(/{{sgst}}/g, round(sgst))
    .replace(/{{igst}}/g, round(igst))
    .replace(/{{total_tax}}/g, round(totalTax))
    .replace(/{{grand_total}}/g, round(grandTotal));

  // ⭐ RAILWAY-SAFE PUPPETEER LAUNCH ⭐
  const isProd = process.env.NODE_ENV === "production";

  const executablePath = isProd
    ? await chromium.executablePath
    : undefined; // Allows puppeteer-core to find local Chrome path

  const browser = await puppeteer.launch({
    args: isProd ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: isProd ? chromium.defaultViewport : null,
    executablePath: executablePath,
    headless: isProd ? chromium.headless : "new", // Use 'new' for local, Chromium default for cloud
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();

  return { pdfBuffer, order };
}