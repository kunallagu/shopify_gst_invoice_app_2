import express from "express";
import { generateInvoicePDF } from "../services/invoiceGenerator.js";
import { getOrderDetails } from "../services/shopify.js";
import { sendInvoiceEmail } from "../services/email.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| 1. ORIGINAL ENDPOINT — DOWNLOAD PDF
|--------------------------------------------------------------------------
*/
router.get("/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const pdfBuffer = await generateInvoicePDF(orderId);

    const order = await getOrderDetails(orderId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Invoice-${order.name}.pdf`,
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).send("Failed to generate invoice");
  }
});


/*
|--------------------------------------------------------------------------
| 2. NEW ENDPOINT — EMAIL PDF TO CUSTOMER
|--------------------------------------------------------------------------
*/
router.post("/email-invoice/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate PDF Buffer
    const pdfBuffer = await generateInvoicePDF(orderId);

    // Send email with PDF attachment
    await sendInvoiceEmail({
      to: email,
      subject: `Invoice for Order #${orderId}`,
      pdfBuffer,
    });

    return res.json({ success: true, message: "Invoice emailed successfully" });

  } catch (err) {
    console.error("EMAIL SEND ERROR:", err);
    return res.status(500).json({ error: "Failed to email invoice" });
  }
});


export default router;
