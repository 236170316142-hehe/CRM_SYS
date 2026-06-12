/**
 * proposalService.js
 *
 * Generates a branded PDF quote/proposal from CRM deal data using PDFKit,
 * then optionally sends it to PandaDoc for e-signature.
 *
 * Flow:
 *   1. Build PDF in memory with PDFKit
 *   2. If PANDADOC_API_KEY is set → upload to PandaDoc → send for e-signature
 *   3. If no PandaDoc → email the PDF directly to the contact
 *   4. Save proposalStatus + proposalUrl on the Deal
 */

const PDFDocument = require('pdfkit');
const axios = require('axios');
const path = require('path');
const { sendEmailNotification } = require('./notifyService');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildProposalPDF(deal, contact, rep) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const DARK  = '#0d1117';
    const BLUE  = '#3b82f6';
    const LIGHT = '#e6edf3';
    const MUTED = '#8b949e';
    const WHITE = '#ffffff';

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 60;
    const contentW = pageW - margin * 2;

    // ── Header background ────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 120).fill(DARK);

    // Company name / brand
    doc.font('Helvetica-Bold').fontSize(22).fillColor(BLUE)
      .text('TEAMGRID CRM', margin, 36);

    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text('Proposal & Quote', margin, 62);

    // Quote number + date top-right
    const quoteNum = `Q-${Date.now().toString().slice(-6)}`;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(LIGHT)
      .text(`Quote #${quoteNum}`, margin, 36, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text(`Date: ${formatDate(new Date())}`, margin, 54, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text(`Valid for: 30 days`, margin, 68, { align: 'right' });

    // Blue accent line
    doc.rect(0, 120, pageW, 4).fill(BLUE);

    let y = 148;

    // ── Prepared For / From ──────────────────────────────────────────────
    const colW = (contentW - 20) / 2;

    // Left box — client
    doc.rect(margin, y, colW, 90).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
      .text('PREPARED FOR', margin + 14, y + 14);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e293b')
      .text(contact?.name || 'Valued Client', margin + 14, y + 28);
    doc.font('Helvetica').fontSize(10).fillColor('#475569')
      .text(contact?.company || '', margin + 14, y + 46)
      .text(contact?.email || '', margin + 14, y + 60)
      .text(contact?.phone || '', margin + 14, y + 74);

    // Right box — rep
    const rx = margin + colW + 20;
    doc.rect(rx, y, colW, 90).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
      .text('YOUR ACCOUNT MANAGER', rx + 14, y + 14);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e293b')
      .text(rep?.name || 'Teamgrid Sales', rx + 14, y + 28);
    doc.font('Helvetica').fontSize(10).fillColor('#475569')
      .text('Teamgrid CRM', rx + 14, y + 46)
      .text(rep?.email || 'sales@teamgrid.com', rx + 14, y + 60);

    y += 110;

    // ── Deal summary ─────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b')
      .text(deal.title, margin, y);
    y += 26;

    doc.moveTo(margin, y).lineTo(margin + contentW, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 16;

    // Table header
    doc.rect(margin, y, contentW, 28).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE)
      .text('Description', margin + 14, y + 8)
      .text('Qty', margin + contentW - 150, y + 8)
      .text('Unit Price', margin + contentW - 100, y + 8)
      .text('Amount', margin + contentW - 46, y + 8);
    y += 28;

    // Table row
    doc.rect(margin, y, contentW, 36).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica').fontSize(11).fillColor('#1e293b')
      .text(deal.title, margin + 14, y + 12);
    doc.font('Helvetica').fontSize(11).fillColor('#475569')
      .text('1', margin + contentW - 150, y + 12)
      .text(formatCurrency(deal.value), margin + contentW - 100, y + 12)
      .text(formatCurrency(deal.value), margin + contentW - 46, y + 12);
    y += 36;

    // Totals
    y += 16;
    const totX = margin + contentW - 200;

    const drawTotal = (label, value, bold = false, color = '#1e293b') => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 11);
      doc.fillColor(bold ? color : '#475569').text(label, totX, y);
      doc.fillColor(bold ? color : '#1e293b').text(value, totX, y, { align: 'right', width: 200 });
      y += bold ? 22 : 18;
    };

    doc.moveTo(totX, y).lineTo(totX + 200, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 8;
    drawTotal('Subtotal', formatCurrency(deal.value));
    drawTotal('Tax (0%)', formatCurrency(0));
    doc.moveTo(totX, y).lineTo(totX + 200, y).strokeColor('#94a3b8').lineWidth(1).stroke();
    y += 8;
    drawTotal('TOTAL', formatCurrency(deal.value), true, BLUE);

    y += 24;

    // ── Terms ────────────────────────────────────────────────────────────
    doc.moveTo(margin, y).lineTo(margin + contentW, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 20;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('Terms & Conditions', margin, y);
    y += 18;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('1. This quote is valid for 30 days from the date of issue.', margin, y); y += 13;
    doc.text('2. Payment is due within 14 days of invoice.', margin, y); y += 13;
    doc.text('3. Prices are in USD and exclusive of applicable taxes unless stated.', margin, y); y += 13;
    doc.text('4. This proposal constitutes an offer and is subject to formal agreement.', margin, y);

    // ── Signature section ────────────────────────────────────────────────
    y += 36;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('Authorisation', margin, y);
    y += 18;

    const sigColW = (contentW - 20) / 2;

    // Client sig box
    doc.rect(margin, y, sigColW, 64).stroke('#e2e8f0');
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('Client Signature', margin + 10, y + 10);
    doc.moveTo(margin + 10, y + 46).lineTo(margin + sigColW - 10, y + 46)
      .strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('Name & Date', margin + 10, y + 50);

    // Rep sig box
    const sx2 = margin + sigColW + 20;
    doc.rect(sx2, y, sigColW, 64).stroke('#e2e8f0');
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('Account Manager', sx2 + 10, y + 10);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b')
      .text(rep?.name || 'Teamgrid Sales', sx2 + 10, y + 26);
    doc.moveTo(sx2 + 10, y + 46).lineTo(sx2 + sigColW - 10, y + 46)
      .strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(formatDate(new Date()), sx2 + 10, y + 50);

    // ── Footer ───────────────────────────────────────────────────────────
    doc.rect(0, pageH - 44, pageW, 44).fill(DARK);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(
        `Teamgrid CRM  ·  Generated on ${formatDate(new Date())}  ·  Quote #${quoteNum}`,
        margin, pageH - 26, { align: 'center', width: contentW }
      );

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PandaDoc integration
// ─────────────────────────────────────────────────────────────────────────────

async function sendToPandaDoc(pdfBuffer, deal, contact, rep) {
  const apiKey = process.env.PANDADOC_API_KEY;
  if (!apiKey) return null;

  const base64PDF = pdfBuffer.toString('base64');
  const fileName = `Proposal_${deal.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

  try {
    // Step 1: Create document from PDF
    const createRes = await axios.post(
      'https://api.pandadoc.com/public/v1/documents',
      {
        name: `Proposal: ${deal.title}`,
        url: null,
        file_urls: null,
        content_placeholders: [],
        recipients: [
          {
            email: contact.email,
            first_name: contact.name.split(' ')[0],
            last_name: contact.name.split(' ').slice(1).join(' ') || '',
            role: 'client',
          },
        ],
        fields: {
          deal_title:    { value: deal.title },
          deal_value:    { value: formatCurrency(deal.value) },
          contact_name:  { value: contact.name },
          contact_email: { value: contact.email },
          rep_name:      { value: rep?.name || 'Teamgrid Sales' },
          valid_until:   { value: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) },
        },
        parse_form_fields: false,
        tags: ['crm', 'auto-generated'],
        metadata: { dealId: deal._id.toString() },
        // Attach the PDF as a base64 file
        files: [{ data: base64PDF, name: fileName }],
      },
      {
        headers: {
          Authorization: `API-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const docId = createRes.data.id;
    console.log(`[PandaDoc] Document created: ${docId}`);

    // Step 2: Wait for document to process (poll status)
    let status = 'document.uploaded';
    let attempts = 0;
    while (status !== 'document.draft' && attempts < 10) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await axios.get(
        `https://api.pandadoc.com/public/v1/documents/${docId}`,
        { headers: { Authorization: `API-Key ${apiKey}` } }
      );
      status = statusRes.data.status;
      attempts++;
    }

    // Step 3: Send for e-signature
    await axios.post(
      `https://api.pandadoc.com/public/v1/documents/${docId}/send`,
      {
        message: `Hi ${contact.name.split(' ')[0]},\n\nPlease find attached your proposal for ${deal.title}. Review and sign at your earliest convenience.\n\nBest regards,\n${rep?.name || 'Teamgrid Sales'}`,
        silent: false,
      },
      { headers: { Authorization: `API-Key ${apiKey}` } }
    );

    // Step 4: Get shareable link
    const linkRes = await axios.post(
      `https://api.pandadoc.com/public/v1/documents/${docId}/session`,
      { recipient: contact.email, lifetime: 7776000 },
      { headers: { Authorization: `API-Key ${apiKey}` } }
    );

    const shareUrl = `https://app.pandadoc.com/s/${linkRes.data.id}`;
    console.log(`[PandaDoc] Sent for e-signature. Link: ${shareUrl}`);

    return { docId, shareUrl };
  } catch (err) {
    console.error('[PandaDoc] Error:', err.response?.data || err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email the PDF directly (fallback when PandaDoc is not configured)
// ─────────────────────────────────────────────────────────────────────────────

async function emailProposalDirectly(pdfBuffer, deal, contact, rep) {
  const nodemailer = require('nodemailer');

  let transport = null;
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }

  if (!transport) {
    console.log(`[Proposal] No email transport — PDF generated but not sent to ${contact.email}`);
    return;
  }

  const FROM = process.env.EMAIL_FROM || `Teamgrid CRM <${process.env.GMAIL_USER}>`;
  const fileName = `Proposal_${deal.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

  await transport.sendMail({
    from: FROM,
    to: contact.email,
    cc: rep?.email || undefined,
    subject: `Your Proposal: ${deal.title}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid #3b82f6;">
            <span style="font-size:18px;font-weight:800;color:#3b82f6;">⚡ Teamgrid CRM</span>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:36px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#e6edf3;">
              Your Proposal is Ready, ${contact.name.split(' ')[0]}
            </h2>
            <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.7;">
              Please find your proposal for <strong style="color:#e6edf3;">${deal.title}</strong>
              attached to this email.
            </p>
            <table cellpadding="14" cellspacing="0" border="0"
                   style="width:100%;background:#1c2330;border:1px solid rgba(59,130,246,0.15);
                          border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Deal</span><br/>
                  <span style="font-size:15px;font-weight:700;color:#e6edf3;">${deal.title}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Total Value</span><br/>
                  <span style="font-size:22px;font-weight:800;color:#3b82f6;">${formatCurrency(deal.value)}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.7;">
              This proposal is valid for <strong style="color:#e6edf3;">30 days</strong>.
              To accept, please sign and return the attached PDF or reply to this email.
            </p>
            <p style="margin:0;font-size:13px;color:#4a5568;">
              Questions? Reply directly and ${rep?.name || 'our team'} will get back to you.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:20px 36px 24px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 2px;font-size:13px;color:#4a5568;">Warm regards,</p>
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#e6edf3;">${rep?.name || 'Teamgrid Sales'}</p>
            <p style="margin:0;font-size:12px;color:#4a5568;">Teamgrid CRM${rep?.email ? ` · ${rep.email}` : ''}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(`[Proposal] PDF emailed directly to ${contact.email}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry — called when deal stage → 'proposal'
// ─────────────────────────────────────────────────────────────────────────────

async function generateAndSendProposal(deal, contact, rep) {
  console.log(`[Proposal] Generating for deal: ${deal.title}`);

  // 1. Generate PDF
  const pdfBuffer = await buildProposalPDF(deal, contact, rep);
  console.log(`[Proposal] PDF generated — ${Math.round(pdfBuffer.length / 1024)}KB`);

  let pandaResult = null;

  // 2. Try PandaDoc first
  if (process.env.PANDADOC_API_KEY) {
    pandaResult = await sendToPandaDoc(pdfBuffer, deal, contact, rep);
  }

  // 3. Fall back to direct email with PDF attachment
  if (!pandaResult) {
    await emailProposalDirectly(pdfBuffer, deal, contact, rep);
  }

  // 4. Return result for the caller to save on the Deal
  return {
    pdfBuffer,
    pandaDocId:  pandaResult?.docId  || null,
    proposalUrl: pandaResult?.shareUrl || null,
    status: pandaResult ? 'sent' : 'sent',
  };
}

module.exports = { generateAndSendProposal, buildProposalPDF };
