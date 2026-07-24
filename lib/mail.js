const nodemailer = require("nodemailer");

async function sendTicketMail(email, name, ticketFile) {

    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPassword) {
        console.warn("⚠️ EMAIL_USER or EMAIL_PASSWORD not set in environment. Skipping mail dispatch.");
        return false;
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: emailUser,
            pass: emailPassword
        }
    });


    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your Event Ticket",
            html: `
<h2>Hello ${name}</h2>
<p>Your booking is confirmed.</p>
<p>Your ticket is attached.</p>
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