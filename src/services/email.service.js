/**
 * Email Service
 * -----------------
 * Centralized email utility powered by Nodemailer.
 * Supports text/HTML emails, templates, and future extensibility.
 */

const nodemailer = require("nodemailer");
const config = require("../config/app.config");

class EmailService {
  constructor() {
    if (!config.EMAIL_USERNAME || !config.EMAIL_PASSWORD) {
      throw new Error("Email credentials are missing in app.config");
    }

    this.transporter = nodemailer.createTransport({
      service: config.EMAIL_SERVICE,
      auth: {
        user: config.EMAIL_USERNAME,
        pass: config.EMAIL_PASSWORD,
      },
    });

    this.transporter.verify((err) => {
      if (err) {
        console.error("Email server connection failed:", err.message);
      } else {
        console.log("[MAILER] Ready to send emails");
      }
    });
  }

  /**
   * Send an email
   * @param {Object} options
   * @param {string|string[]} options.to - Recipient(s)
   * @param {string} options.subject - Subject line
   * @param {string} [options.text] - Plain text version
   * @param {string} [options.html] - HTML version
   */
  async send({ to, subject, text, html }) {
    const mailOptions = {
      from: config.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}: ${subject}`);
      return info;
    } catch (error) {
      console.error("Email send failed:", error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

module.exports = new EmailService();
