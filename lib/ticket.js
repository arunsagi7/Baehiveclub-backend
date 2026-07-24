const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

async function createTicket(data) {
    const dir = path.join(__dirname, "../tickets/generated");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, `${data.ticket_no}.pdf`);

    const qr = await QRCode.toDataURL(data.ticket_no);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        doc.fontSize(25).text("EVENT TICKET");
        doc.moveDown();

        doc.fontSize(14)
            .text(`Name: ${data.name}`)
            .text(`Event: ${data.event}`)
            .text(`Ticket No: ${data.ticket_no}`);

        doc.moveDown();
        doc.image(qr, { width: 100 });

        doc.end();

        writeStream.on("finish", () => {
            resolve(filePath);
        });

        writeStream.on("error", (err) => {
            reject(err);
        });
    });
}

module.exports = { createTicket };