// import nodemailer from "nodemailer";
import { Resend } from "resend";

const createResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY env variable");
  }
  return new Resend(apiKey);
};

/**
 * Creates a reusable Nodemailer transporter.
 * Uses Gmail OAuth2 or a plain SMTP service depending on env vars.
 * For development, falls back to Ethereal (a fake SMTP that captures emails).
 */
// const createTransporter = async () => {
//   console.log("SMTP_HOST INSIDE EMAIL FILE:", process.env.SMTP_HOST);

//   if (process.env.SMTP_HOST) {
//     console.log("USING GMAIL SMTP");

//     return nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: parseInt(process.env.SMTP_PORT, 10) || 587,
//       secure: process.env.SMTP_SECURE === "true",
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });
//   }

//   console.log("USING ETHEREAL");


//   // ── Development fallback: Ethereal fake SMTP ──────────────────────────────
//   // Emails are captured at https://ethereal.email — nothing is actually sent.
//   // The preview URL is logged to the console.
//   const testAccount = await nodemailer.createTestAccount();
//   return nodemailer.createTransport({
//     host: "smtp.ethereal.email",
//     port: 587,
//     secure: false,
//     auth: {
//       user: testAccount.user,
//       pass: testAccount.pass,
//     },
//   });
// };

/**
 * Sends an email.
 * @param {object} options
 * @param {string} options.to        - recipient email
 * @param {string} options.subject   - subject line
 * @param {string} options.html      - HTML body
 * @param {string} [options.text]    - plain-text fallback
 */
// export const sendEmail = async ({ to, subject, html, text }) => {
//   console.log("1. Creating transporter...");
//   const transporter = await createTransporter();
//   console.log("2. Verifying transporter...");
//   await transporter.verify();

//   console.log("3. Transport verified.");

//   console.log("4. Sending email...");
//   const mailOptions = {
//     from: `"${process.env.APP_NAME || "GrocCart"}" <${process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@grocart.com"}>`,
//     to,
//     subject,
//     html,
//     text: text || html.replace(/<[^>]+>/g, ""), // strip tags for plain-text
//   };

//   const info = await transporter.sendMail(mailOptions);

//   // In development, log the Ethereal preview URL
//   if (!process.env.SMTP_HOST) {
//     console.log("📧 Email preview URL:", nodemailer.getTestMessageUrl(info));
//   }

//   return info;
// };

export const sendEmail = async ({ to, subject, html }) => {
  const resend = createResendClient();
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend Error:", error);
    throw new Error(error.message);
  }

  console.log("Email sent:", data);

  return data;
};

/**
 * Sends the email-verification email after registration.
 * @param {string} to            - recipient email address
 * @param {string} firstName     - used in greeting
 * @param {string} verifyUrl     - full verification URL with token
 */
export const sendVerificationEmail = async (to, firstName, verifyUrl) => {
  const appName = process.env.APP_NAME || "GroCart";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Verify your email – ${appName}</title>
      <style>
        body { margin: 0; padding: 0; background: #f6f9fc; font-family: Arial, sans-serif; }
        .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px;
                   box-shadow: 0 4px 24px rgba(0,0,0,.08); overflow: hidden; }
        .header  { background: linear-gradient(135deg, #16a34a, #059669); padding: 40px 32px;
                   text-align: center; }
        .header h1 { margin: 0; color: #fff; font-size: 28px; }
        .header p  { margin: 4px 0 0; color: #d1fae5; font-size: 14px; }
        .body    { padding: 36px 32px; color: #374151; line-height: 1.6; }
        .body p  { margin: 0 0 16px; }
        .btn-wrap { text-align: center; margin: 28px 0; }
        .btn     { display: inline-block; background: #16a34a; color: #fff !important;
                   text-decoration: none; padding: 14px 36px; border-radius: 8px;
                   font-size: 16px; font-weight: bold; letter-spacing: .4px; }
        .footer  { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px;
                   text-align: center; font-size: 12px; color: #9ca3af; }
        .url-box { word-break: break-all; font-size: 12px; color: #6b7280;
                   background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>🛒 ${appName}</h1>
          <p>Fresh · Fast · Reliable</p>
        </div>
        <div class="body">
          <p>Hi <strong>${firstName}</strong>,</p>
          <p>Thanks for signing up! Please confirm your email address to activate your account.</p>
          <p>This link expires in <strong>24 hours</strong>.</p>
          <div class="btn-wrap">
            <a href="${verifyUrl}" class="btn">Verify My Email</a>
          </div>
          <p>If the button doesn't work, copy and paste this URL into your browser:</p>
          <div class="url-box">${verifyUrl}</div>
          <p style="margin-top:24px; font-size:13px; color:#6b7280;">
            If you didn't create an account with ${appName}, you can safely ignore this email.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    </body>
    </html>`;

  return sendEmail({ to, subject: `Verify your email – ${appName}`, html });
};