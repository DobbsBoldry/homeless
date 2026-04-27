import PDFDocument from 'pdfkit';
import type { EvictionFiling } from '@/db/schema/eviction-filings';

const PAGE_MARGIN = 64;
const FONT_BODY = 'Helvetica';
const FONT_OBLIQUE = 'Helvetica-Oblique';

interface RenderOpts {
  letterText: string;
  filing: EvictionFiling;
}

/**
 * Render a tenant outreach letter to a one-page PDF the attorney can
 * print and mail. Way leaner than the packet renderer (#21): the
 * letter is just paragraphs of plain text, no markdown structure to
 * walk. Header carries the date + case number; footer carries the
 * "letter assisted by AI; reviewed by KLA-Owensboro" reminder.
 *
 * The attorney is expected to have replaced the `[KLA Owensboro phone]`
 * placeholder before exporting; we do NOT enforce that — flagging
 * unfilled placeholders is the attorney's job during review.
 */
export async function renderOutreachLetterPdf(opts: RenderOpts): Promise<Buffer> {
  const { letterText, filing } = opts;
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + 28, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `Outreach letter — ${filing.caseNumber}`,
      Author: 'Daviess Coalition Platform (AI-assisted)',
      Subject: `KLA outreach to ${filing.defendantFirstName} ${filing.defendantLastName}`,
      Keywords: 'outreach kla ai-assisted attorney-reviewed',
    },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Header: letterhead-light. The attorney pastes onto real letterhead
  // most of the time; this PDF is the standalone fallback.
  doc.font(FONT_BODY).fontSize(10).fillColor('#555');
  doc.text('Kentucky Legal Aid — Owensboro Office', { align: 'left' });
  doc.text(new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#888');
  doc.text(`Re: Case ${filing.caseNumber}`, { align: 'left' });
  doc.moveDown(1.5);

  // Body: paragraphs separated by blank lines. We split on \n\n to
  // collapse Anthropic's prose into discrete paragraphs; single \n
  // becomes a soft line break (rare in this kind of letter, but
  // common when the attorney inserted an action-list).
  doc.fontSize(11).fillColor('#000');
  const paragraphs = letterText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const para of paragraphs) {
    doc.text(para, { align: 'left', lineGap: 2 });
    doc.moveDown(0.7);
  }

  // Footer (every page, repeated by pdfkit if the letter ever spills).
  const footerY = doc.page.height - PAGE_MARGIN;
  doc
    .font(FONT_OBLIQUE)
    .fontSize(8)
    .fillColor('#888')
    .text(
      `${filing.caseNumber} · Assisted by AI; reviewed by KLA-Owensboro before mailing.`,
      PAGE_MARGIN,
      footerY,
      { align: 'center', width: doc.page.width - PAGE_MARGIN * 2 },
    );

  doc.end();
  return finished;
}
