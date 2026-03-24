import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface BillData {
  orderId: string;
  createdAt: Date;
  customer: { id: string; name: string; phone: string };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
}

@Injectable()
export class BillService {
  /**
   * Generates a PDF bill and returns it as a Buffer.
   */
  generatePdf(data: BillData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      // PDFDocument is a Node.js Readable stream
      (doc as NodeJS.ReadableStream).on('data', (chunk: Buffer) => chunks.push(chunk));
      (doc as NodeJS.ReadableStream).on('end', () => resolve(Buffer.concat(chunks)));
      (doc as NodeJS.ReadableStream).on('error', reject);

      this.renderBill(doc, data);
      doc.end();
    });
  }

  private renderBill(doc: PDFKit.PDFDocument, data: BillData): void {
    const { orderId, createdAt, customer, items, subtotal, discount, total, paymentMethod } = data;

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('BAKERY POS', { align: 'center' })
      .fontSize(10)
      .font('Helvetica')
      .text('Receipt / Bill', { align: 'center' })
      .moveDown(0.5);

    this.drawDivider(doc);

    // ── Order meta ───────────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Order ID : ${orderId}`)
      .text(`Date     : ${createdAt.toLocaleString()}`)
      .text(`Customer : ${customer.name}`)
      .text(`Phone    : ${customer.phone}`)
      .text(`Payment  : ${paymentMethod}`)
      .moveDown(0.5);

    this.drawDivider(doc);

    // ── Items table header ───────────────────────────────────────────────────
    const col = { item: 50, qty: 300, price: 370, total: 460 };

    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Item', col.item, headerY);
    doc.text('Qty', col.qty, headerY);
    doc.text('Unit Price', col.price, headerY);
    doc.text('Total', col.total, headerY);
    doc.moveDown(0.3);

    this.drawDivider(doc);

    // ── Items rows ───────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9);

    for (const item of items) {
      const lineTotal = item.price * item.quantity;
      const rowY = doc.y;
      doc.text(item.name, col.item, rowY, { width: 240 });
      doc.text(String(item.quantity), col.qty, rowY);
      doc.text(`$${item.price.toFixed(2)}`, col.price, rowY);
      doc.text(`$${lineTotal.toFixed(2)}`, col.total, rowY);
      doc.moveDown(0.2);
    }

    this.drawDivider(doc);

    // ── Totals ───────────────────────────────────────────────────────────────
    const totalsX = 370;

    const subtotalY = doc.y;
    doc.font('Helvetica').fontSize(9);
    doc.text('Subtotal:', totalsX, subtotalY);
    doc.text(`$${subtotal.toFixed(2)}`, col.total, subtotalY);
    doc.moveDown(0.2);

    if (discount > 0) {
      const discountY = doc.y;
      doc.text('Discount:', totalsX, discountY);
      doc.text(`-$${discount.toFixed(2)}`, col.total, discountY);
      doc.moveDown(0.2);
    }

    const totalY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL:', totalsX, totalY);
    doc.text(`$${total.toFixed(2)}`, col.total, totalY);
    doc.moveDown(1);

    this.drawDivider(doc);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Thank you for your purchase!', { align: 'center' })
      .text('Please come again.', { align: 'center' });
  }

  private drawDivider(doc: PDFKit.PDFDocument): void {
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor('#cccccc')
      .stroke()
      .moveDown(0.3);
  }
}
