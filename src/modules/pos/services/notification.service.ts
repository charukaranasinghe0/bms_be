import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const twilio = require('twilio') as any;

export interface OrderNotificationData {
  customer: { name: string; phone: string; email?: string | null };
  orderId: string;
  total: number;
  paymentMethod: string;
  pdfBuffer: Buffer;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOrderNotifications(data: OrderNotificationData): Promise<void> {
    const { customer, orderId, total, paymentMethod, pdfBuffer } = data;

    // Run email + SMS in parallel; failures are logged but never throw
    await Promise.allSettled([
      this.sendEmail(customer, orderId, total, paymentMethod, pdfBuffer),
      this.sendSms(customer, orderId, total),
    ]);
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  private async sendEmail(
    customer: OrderNotificationData['customer'],
    orderId: string,
    total: number,
    paymentMethod: string,
    pdfBuffer: Buffer,
  ): Promise<void> {
    if (!customer.email) {
      this.logger.log(`No email for customer — skipping email for order ${orderId}`);
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured — skipping email notification');
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Bakery POS" <${from}>`,
      to: customer.email,
      subject: `Your Order Receipt — #${orderId.slice(0, 8).toUpperCase()}`,
      html: this.buildEmailHtml(customer.name, orderId, total, paymentMethod),
      attachments: [
        {
          filename: `receipt-${orderId.slice(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    this.logger.log(`Receipt email sent to ${customer.email} for order ${orderId}`);
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  private async sendSms(
    customer: OrderNotificationData['customer'],
    orderId: string,
    total: number,
  ): Promise<void> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('Twilio not configured — skipping SMS notification');
      return;
    }

    const client = twilio(accountSid, authToken);
    const shortId = orderId.slice(0, 8).toUpperCase();
    const body = `Hi ${customer.name}, your Bakery order #${shortId} has been placed. Total: $${total.toFixed(2)} (CASH). Thank you!`;

    // Normalize phone: ensure it starts with +
    const toNumber = customer.phone.startsWith('+')
      ? customer.phone
      : `+${customer.phone}`;

    await client.messages.create({ body, from: fromNumber, to: toNumber });
    this.logger.log(`SMS sent to ${toNumber} for order ${orderId}`);
  }

  // ── Email HTML template ────────────────────────────────────────────────────
  private buildEmailHtml(
    name: string,
    orderId: string,
    total: number,
    paymentMethod: string,
  ): string {
    const shortId = orderId.slice(0, 8).toUpperCase();
    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#333;margin-bottom:4px">Bakery POS — Order Receipt</h2>
        <p style="color:#666;font-size:13px">Thank you for your purchase, <strong>${name}</strong>!</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
        <table style="width:100%;font-size:14px">
          <tr><td style="color:#888">Order ID</td><td><strong>#${shortId}</strong></td></tr>
          <tr><td style="color:#888">Total</td><td><strong>$${total.toFixed(2)}</strong></td></tr>
          <tr><td style="color:#888">Payment</td><td>${paymentMethod}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
        <p style="font-size:12px;color:#aaa">Your full receipt is attached as a PDF.</p>
      </div>
    `;
  }
}
