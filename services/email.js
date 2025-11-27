import nodemailer from "nodemailer";

export async function sendInvoiceEmail({ to, subject, pdfBuffer }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: '"Elyta" <support@elyta.in>',
    to,
    subject,
    text: "Please find your invoice attached.",
    attachments: [
      {
        filename: "invoice.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return true;
}
