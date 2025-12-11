import express from "express";
import { generateInvoicePDF } from "../services/invoiceGenerator.js";
import { getOrderDetails } from "../services/shopify.js";
import { sendInvoiceEmail } from "../services/email.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| 1. DOWNLOAD PDF ENDPOINT
|--------------------------------------------------------------------------
*/
router.get("/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // FIX: generateInvoicePDF returns { pdfBuffer, order }
    const { pdfBuffer, order } = await generateInvoicePDF(orderId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Invoice-${order.name}.pdf`,
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ 
      error: "Failed to generate invoice",
      details: err.message 
    });
  }
});

/*
|--------------------------------------------------------------------------
| 2. VIEW HTML INVOICE (For testing/preview)
|--------------------------------------------------------------------------
*/
router.get("/html/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await getOrderDetails(orderId);

    // Generate invoice HTML (without PDF conversion)
    const html = generateInvoiceHTML(order);
    res.send(html);

  } catch (err) {
    console.error("HTML generation error:", err);
    res.status(500).send("Failed to generate invoice HTML");
  }
});

/*
|--------------------------------------------------------------------------
| 3. EMAIL PDF TO CUSTOMER
|--------------------------------------------------------------------------
*/
router.post("/email/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // FIX: Destructure properly
    const { pdfBuffer, order } = await generateInvoicePDF(orderId);

    // Send email with PDF attachment
    await sendInvoiceEmail({
      to: email,
      subject: `Invoice for Order ${order.name}`,
      pdfBuffer,
    });

    return res.json({ 
      success: true, 
      message: `Invoice emailed successfully to ${email}` 
    });

  } catch (err) {
    console.error("EMAIL SEND ERROR:", err);
    return res.status(500).json({ 
      error: "Failed to email invoice",
      details: err.message 
    });
  }
});

/*
|--------------------------------------------------------------------------
| 4. GENERATE INVOICE FOR ORDER (API endpoint for Shopify)
|--------------------------------------------------------------------------
*/
router.post("/generate/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { pdfBuffer, order } = await generateInvoicePDF(orderId);

    res.json({
      success: true,
      message: "Invoice generated successfully",
      orderNumber: order.name,
      downloadUrl: `/invoice/${orderId}`
    });

  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ 
      error: "Failed to generate invoice",
      details: err.message 
    });
  }
});

// Helper function to generate HTML (extracted from invoiceGenerator)
function generateInvoiceHTML(order) {
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

  let cgst = 0, sgst = 0, igst = 0;

  if (shipping.province === supplierState || shipping.province_code === supplierStateCode) {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  } else {
    igst = totalTax;
  }

  const round = (x) => x.toFixed(2);
  const customerGSTIN = (billing.gstin && String(billing.gstin).trim()) || "";
  const invoiceType = customerGSTIN ? "B2B" : "B2C";

  let billToBlock = `
    ${billing.first_name || ""} ${billing.last_name || ""}<br>
    ${billing.phone || "—"}<br>
    ${billing.address1 || ""}<br>
    ${billing.city || ""}, ${billing.province || ""}, ${billing.zip || ""}<br>
  `;
  if (customerGSTIN) billToBlock += `GSTIN: ${customerGSTIN}<br>`;

  let shipToBlock = `
    ${shipping.first_name || ""} ${shipping.last_name || ""}<br>
    ${shipping.phone || "—"}<br>
    ${shipping.address1 || ""}<br>
    ${shipping.city || ""}, ${shipping.province || ""}, ${shipping.zip || ""}<br>
  `;

  const invoiceDateObj = new Date(order.created_at);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const formattedDate = `${String(invoiceDateObj.getDate()).padStart(2, "0")}-${months[invoiceDateObj.getMonth()]}-${invoiceDateObj.getFullYear()}`;

  // Build HTML manually instead of reading file
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice - ${order.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
        .top-row { display: flex; justify-content: space-between; align-items: center; }
        .company-details { font-size: 13px; line-height: 18px; width: 50%; }
        .logo-block { width: 50%; text-align: right; }
        .logo-block img { max-width: 180px; }
        .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 8px; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table th, table td { border: 1px solid #222; padding: 6px; }
        .row-flex { display: flex; gap: 20px; width: 100%; }
        .half { width: 50%; }
        .bottom-flex { display: flex; gap: 25px; margin-top: 25px; width: 100%; }
        .half-box { width: 50%; }
        .disclaimer { margin-top: 40px; text-align: center; font-size: 13px; color: #444; }
    </style>
</head>
<body>
    <div class="top-row">
        <div class="company-details">
            <strong>NSKL Ventures LLP</strong><br>
            209, Shilpin Centre, G.D. Ambekar Marg,<br>
            Wadala, Mumbai, 400301<br>
            GSTIN: 27AAWFN7036P1Z8<br>
            Contact: 81690 96900<br>
            Email: support@elyta.in
        </div>
        <div class="logo-block">
            <strong>ELYTA</strong>
        </div>
    </div>

    <div class="section-title">Invoice Details</div>
    <table>
        <tr>
            <td><strong>Invoice Number:</strong> ${order.name}</td>
            <td><strong>Date:</strong> ${formattedDate}</td>
        </tr>
    </table>

    <div class="row-flex">
        <div class="half">
            <div class="section-title">Bill To</div>
            <table><tr><td>${billToBlock}</td></tr></table>
        </div>
        <div class="half">
            <div class="section-title">Ship To</div>
            <table><tr><td>${shipToBlock}</td></tr></table>
        </div>
    </div>

    <div class="section-title">Supply Information</div>
    <table>
        <tr>
            <td><strong>Place of Supply:</strong> ${shipping.province || "—"}</td>
            <td><strong>Type:</strong> ${invoiceType}</td>
        </tr>
    </table>

    <div class="section-title">Items</div>
    <table>
        <thead>
            <tr>
                <th>SKU</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Price (₹)</th>
                <th>Amount (₹)</th>
            </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
    </table>

    <div class="bottom-flex">
        <div class="half-box">
            <div class="section-title">HSN Summary</div>
            <table>
                <tr>
                    <th>HSN</th>
                    <th>Taxable Value</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>IGST</th>
                    <th>Total Tax</th>
                </tr>
                <tr>
                    <td>71131130</td>
                    <td>${round(taxableValue)}</td>
                    <td>${round(cgst)}</td>
                    <td>${round(sgst)}</td>
                    <td>${round(igst)}</td>
                    <td>${round(totalTax)}</td>
                </tr>
            </table>
        </div>

        <div class="half-box">
            <div class="section-title">Amount Summary</div>
            <table>
                <tr><td><strong>Gross Amount</strong></td><td>₹ ${round(grossAmount)}</td></tr>
                <tr><td><strong>Less Discount</strong></td><td>₹ ${round(discountAmount)}</td></tr>
                <tr><td><strong>Net Amount</strong></td><td>₹ ${round(netAmount)}</td></tr>
                <tr><td><strong>Taxable Value</strong></td><td>₹ ${round(taxableValue)}</td></tr>
                <tr><td><strong>CGST (1.5%)</strong></td><td>₹ ${round(cgst)}</td></tr>
                <tr><td><strong>SGST (1.5%)</strong></td><td>₹ ${round(sgst)}</td></tr>
                <tr><td><strong>IGST (3%)</strong></td><td>₹ ${round(igst)}</td></tr>
                <tr><td><strong>Total Tax</strong></td><td>₹ ${round(totalTax)}</td></tr>
                <tr><td><strong>Total Amount</strong></td><td><strong>₹ ${round(grandTotal)}</strong></td></tr>
            </table>
        </div>
    </div>

    <div class="disclaimer">
        This is a computer-generated invoice and does not require a signature.
    </div>
</body>
</html>
  `;
}

export default router;
