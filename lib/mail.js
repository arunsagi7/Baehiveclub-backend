const nodemailer = require("nodemailer");

async function sendTicketMail(email, name, event, ticketFile) {

    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPassword) {
        console.warn("⚠️ EMAIL_USER or EMAIL_PASSWORD not set in environment. Skipping mail dispatch.");
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        pool: true,           // Reuse SMTP connections
        maxConnections: 5,
        maxMessages: 100,
        auth: {
            user: emailUser.trim(),
            pass: emailPassword.replace(/\s+/g, "")
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000
    });



    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your Event Ticket",
            html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8FA;padding:40px 0;font-family:Arial,sans-serif;">
  <tr>
    <td align="center">

      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 25px rgba(0,0,0,.08);">

        <tr>
          <td align="center" style="padding:20px;background:#F54D8B;color:#fff;border-radius:30px;">
            <!-- Container with white background to make the colored logo look premium without needing CSS filters -->
            <div style="background: #ffffff; display: inline-block;  border-radius: 30px;">
              <img src="https://pub-7f2dabc5b5c14daab8ff8b19e15a314e.r2.dev/Beahive%20Official%20Logo%20Color%20PNG.png" width="90" alt="Logo" style="display: block; border: 0;">
            </div>
            <h1 style="margin:20px 0 10px;font-size:32px;">
              🎉 You're Officially In!
            </h1>
            <p style="font-size:18px;margin:0;">
              Your payment has been confirmed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0px 40px;">
            <h2>Hello ${name}</h2>
            <p>Thank you for registering for  <b>${event.eventName}! 🎉</b></p>

            <p>
              Your ticket has been successfully confirmed. Your spot is now secured, and your ticket is attached to this email.
            </p>
            <p>
            We look forward to welcoming you and making this event a memorable experience.
            </p>

            <table width="100%" style="background:#FFF6F9;border-radius:14px;padding:20px;margin:30px 0;">
             <h2 style="margin-top: 0px;">🎟️ Ticket Details</h2>
              <tr><td>📅 <b>Date:</b> ${event.date}</td></tr>
              <tr><td>⏰ <b>Time:</b> ${event.time}</td></tr>
              <tr><td>📍 <b>Location:</b> ${event.location}</td></tr>
              <tr><td>🎟 <b>Ticket:</b> ${event.ticket_type}</td></tr>
            </table>

            <div align="center" style="margin:35px 0;">
              <a href="https://www.baehiveclub.com"
                 style="background:#F54D8B;color:white;text-decoration:none;padding:14px 36px;border-radius:40px;font-weight:bold;">
                View Event
              </a>
            </div>

            <hr style="border:none;border-top:1px solid #eee;">

            <p style="color:#777;font-size:14px;text-align:center;">
              Need help? Reply to this email or contact
              support@baehiveclub.com
            </p>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
`,
            attachments: [
                {
                    filename: "ticket.pdf",
                    path: ticketFile
                }
            ]
        });
        console.log(`✉️ Ticket mail sent successfully to ${email}`);
        return true;
    } catch (error) {
        console.error("❌ Failed to send ticket email:", error.message);
        return false;
    }
}

module.exports = { sendTicketMail };
