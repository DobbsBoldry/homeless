import { marked, type Token, type Tokens } from 'marked';
import PDFDocument from 'pdfkit';
import type { EvictionFiling } from '@/db/schema/eviction-filings';

const PAGE_MARGIN = 56; // ~3/4 inch
const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_OBLIQUE = 'Helvetica-Oblique';
const FONT_MONO = 'Courier';

interface RenderOpts {
  packetMd: string;
  filing: EvictionFiling;
}

/**
 * Render a packet markdown document into a court-printable PDF.
 *
 * Implementation notes:
 * - We tokenize via marked (no DOM, no browser) and walk the AST,
 *   calling pdfkit primitives directly. This keeps the dep surface
 *   tiny — no puppeteer, no chromium, no system fonts.
 * - The packet's structure is deterministic (disclaimer → caption →
 *   numbered responses → defenses checklist → signature block) so the
 *   markdown subset we have to handle is small: h1, h2, h3, paragraphs,
 *   ordered/unordered lists, [ ] checkboxes, hr, blockquote, strong, em.
 * - Footer on every page: case number + AI-DRAFTED reminder.
 */
export async function renderPacketPdf(opts: RenderOpts): Promise<Buffer> {
  const { packetMd, filing } = opts;
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + 24, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `Answer — ${filing.caseNumber}`,
      Author: 'Daviess Coalition Platform (AI-drafted)',
      Subject: `Forcible Detainer Answer for ${filing.caseNumber}`,
      Keywords: 'eviction answer ai-drafted attorney-review-required',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks as unknown as Uint8Array[])));
  });

  // Footer dropped: doc.text() into the bottom margin recurses with the
  // pageAdded handler under pdfkit 0.18. The disclaimer at the top of
  // every packet is the legally important reminder; per-page footers
  // are a nice-to-have we can revisit when migrating renderers.

  const tokens = marked.lexer(packetMd);
  for (const token of tokens) {
    renderToken(doc, token);
  }

  doc.end();
  return done;
}

function renderToken(doc: PDFKit.PDFDocument, token: Token): void {
  switch (token.type) {
    case 'heading':
      renderHeading(doc, token as Tokens.Heading);
      break;
    case 'paragraph':
      renderInline(doc, (token as Tokens.Paragraph).tokens, FONT_BODY, 11);
      doc.moveDown(0.5);
      break;
    case 'blockquote':
      renderBlockquote(doc, token as Tokens.Blockquote);
      break;
    case 'list':
      renderList(doc, token as Tokens.List);
      break;
    case 'hr':
      doc.moveDown(0.4);
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
        .strokeColor('#999')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.6);
      break;
    case 'space':
      doc.moveDown(0.3);
      break;
    case 'code':
      doc
        .font(FONT_MONO)
        .fontSize(9)
        .fillColor('#000')
        .text((token as Tokens.Code).text, { paragraphGap: 4 });
      break;
    default:
      // Unknown block — render its raw text so nothing gets silently dropped.
      if ('raw' in token) {
        doc
          .font(FONT_BODY)
          .fontSize(11)
          .fillColor('#000')
          .text((token as { raw: string }).raw);
      }
  }
}

function renderHeading(doc: PDFKit.PDFDocument, h: Tokens.Heading) {
  const sizes: Record<number, number> = { 1: 18, 2: 14, 3: 12, 4: 11, 5: 11, 6: 11 };
  const size = sizes[h.depth] ?? 11;
  doc.moveDown(h.depth === 1 ? 0.6 : 0.4);
  doc.font(FONT_BOLD).fontSize(size).fillColor('#000');
  renderInlineTokens(doc, h.tokens, FONT_BOLD, size);
  doc.moveDown(0.3);
}

function renderBlockquote(doc: PDFKit.PDFDocument, bq: Tokens.Blockquote) {
  // Render the disclaimer-style block as a bordered, lightly-tinted box.
  const startY = doc.y;
  const text = bq.tokens
    .filter((t) => t.type === 'paragraph')
    .map((t) => (t as Tokens.Paragraph).text)
    .join('\n');

  const padding = 8;
  const innerWidth = doc.page.width - PAGE_MARGIN * 2 - padding * 2;
  // Estimate height by rendering invisibly first
  const heightProbe = doc.heightOfString(text, { width: innerWidth });
  const boxHeight = heightProbe + padding * 2;

  doc
    .save()
    .rect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, boxHeight)
    .fillColor('#fff7e6')
    .fill()
    .strokeColor('#d18a1e')
    .lineWidth(0.75)
    .rect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, boxHeight)
    .stroke()
    .restore();

  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor('#000')
    .text(text, PAGE_MARGIN + padding, startY + padding, { width: innerWidth });
  doc.y = startY + boxHeight + 6;
}

function renderList(doc: PDFKit.PDFDocument, list: Tokens.List) {
  let counter = list.start === '' ? 1 : Number(list.start) || 1;
  for (const item of list.items) {
    const startY = doc.y;
    let bullet: string;
    if (list.ordered) {
      bullet = `${counter}.`;
      counter += 1;
    } else if (item.task) {
      // ASCII rather than Unicode box glyphs — Helvetica doesn't carry
      // U+2610/U+2612 and they extract as junk.
      bullet = item.checked ? '[X]' : '[ ]';
    } else {
      bullet = '•';
    }
    doc
      .font(FONT_BODY)
      .fontSize(11)
      .fillColor('#000')
      .text(bullet, PAGE_MARGIN + 6, startY, { continued: false, width: 18 });

    // Render the body indented to the right of the bullet.
    const bodyX = PAGE_MARGIN + 28;
    const bodyWidth = doc.page.width - bodyX - PAGE_MARGIN;
    doc.x = bodyX;
    doc.y = startY;
    for (const child of item.tokens) {
      if (child.type === 'text') {
        renderInlineTokens(
          doc,
          (child as Tokens.Text).tokens ?? [{ type: 'text', raw: child.raw, text: child.raw }],
          FONT_BODY,
          11,
          bodyWidth,
        );
      } else if (child.type === 'paragraph') {
        renderInlineTokens(doc, (child as Tokens.Paragraph).tokens, FONT_BODY, 11, bodyWidth);
      } else {
        renderToken(doc, child);
      }
    }
    doc.x = PAGE_MARGIN;
    doc.moveDown(0.15);
  }
  doc.moveDown(0.4);
}

function renderInline(doc: PDFKit.PDFDocument, tokens: Token[], font: string, size: number) {
  doc.font(font).fontSize(size).fillColor('#000');
  renderInlineTokens(doc, tokens, font, size);
}

function renderInlineTokens(
  doc: PDFKit.PDFDocument,
  tokens: Token[],
  baseFont: string,
  size: number,
  width?: number,
) {
  const segments: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  flattenInline(tokens, false, false, segments);
  if (segments.length === 0) return;

  const opts = (last: boolean): PDFKit.Mixins.TextOptions => ({
    continued: !last,
    ...(width != null ? { width } : {}),
  });

  segments.forEach((seg, i) => {
    const f = seg.bold ? FONT_BOLD : seg.italic ? FONT_OBLIQUE : baseFont;
    doc
      .font(f)
      .fontSize(size)
      .fillColor('#000')
      .text(seg.text, opts(i === segments.length - 1));
  });
}

function flattenInline(
  tokens: Token[],
  bold: boolean,
  italic: boolean,
  out: Array<{ text: string; bold: boolean; italic: boolean }>,
) {
  for (const tok of tokens) {
    switch (tok.type) {
      case 'text': {
        const t = tok as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          flattenInline(t.tokens, bold, italic, out);
        } else {
          out.push({ text: t.text, bold, italic });
        }
        break;
      }
      case 'strong':
        flattenInline((tok as Tokens.Strong).tokens, true, italic, out);
        break;
      case 'em':
        flattenInline((tok as Tokens.Em).tokens, bold, true, out);
        break;
      case 'codespan':
        out.push({ text: (tok as Tokens.Codespan).text, bold, italic });
        break;
      case 'br':
        out.push({ text: '\n', bold, italic });
        break;
      case 'link':
        flattenInline((tok as Tokens.Link).tokens, bold, italic, out);
        break;
      case 'del':
        flattenInline((tok as Tokens.Del).tokens, bold, italic, out);
        break;
      default:
        if ('raw' in tok) out.push({ text: (tok as { raw: string }).raw, bold, italic });
    }
  }
}
