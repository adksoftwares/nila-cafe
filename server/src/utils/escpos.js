/**
 * ESC/POS Thermal Receipt Printer Protocol & Cash Drawer Pulse Generator
 * Supports standard 80mm (48 cols) and 58mm (32 cols) POS thermal printers.
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

export const ESCPOS_COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]), // ESC @
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x11]),
  NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),
  LINE_FEED: new Uint8Array([LF]),
  FEED_3: new Uint8Array([ESC, 0x64, 0x03]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x41, 0x03]), // Feed 3 lines & cut
  DRAWER_KICK_PIN2: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]), // RJ11 Pin 2 Pulse (50ms ON, 500ms OFF)
  DRAWER_KICK_PIN5: new Uint8Array([ESC, 0x70, 0x01, 0x19, 0xFA])  // RJ11 Pin 5 Pulse
};

/**
 * Align Left text and Right text on paper margins.
 */
export function formatTwoColumns(left, right, width = 48) {
  const l = String(left || '');
  const r = String(right || '');
  const spaceNeeded = width - l.length - r.length;
  if (spaceNeeded > 0) {
    return l + ' '.repeat(spaceNeeded) + r;
  }
  const maxLeft = Math.max(0, width - r.length - 1);
  return l.slice(0, maxLeft) + ' ' + r;
}

/**
 * Format currency without symbol for tight thermal print columns.
 */
function fmtMoney(amount) {
  return Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Concatenates multiple Uint8Array chunks into a single binary buffer.
 */
function concatBuffers(buffers) {
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Generates an ESC/POS binary receipt buffer for an order.
 *
 * @param {Object} sale - Sale transaction object
 * @param {Object} [options]
 * @param {number} [options.paperWidth=80] - 80 for 80mm (48 cols), 58 for 58mm (32 cols)
 * @param {boolean} [options.pulseDrawer=false] - Whether to send cash drawer kick pulse
 * @param {string} [options.shopName='ADK Cafe']
 * @param {string} [options.shopAddress='Colombo, Sri Lanka']
 * @param {string} [options.shopPhone='+94 77 123 4567']
 * @returns {Uint8Array} Binary ESC/POS buffer ready to transmit to thermal printer
 */
export function generateReceiptESCPOS(sale, options = {}) {
  const {
    paperWidth = 80,
    pulseDrawer = false,
    shopName = 'ADK Cafe',
    shopAddress = 'Colombo, Sri Lanka',
    shopPhone = '+94 77 123 4567'
  } = options;

  const cols = paperWidth === 58 ? 32 : 48;
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);
  const encoder = new TextEncoder();
  const chunks = [];

  const add = (cmd) => chunks.push(cmd);
  const addText = (text) => chunks.push(encoder.encode(text + '\n'));

  // 1. Initialize Printer
  add(ESCPOS_COMMANDS.INIT);

  // 2. Cash Drawer Pulse (if cash checkout requested)
  if (pulseDrawer) {
    add(ESCPOS_COMMANDS.DRAWER_KICK_PIN2);
  }

  // 3. Header: Shop Name (Double size & Centered)
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  add(ESCPOS_COMMANDS.BOLD_ON);
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(shopName);
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);

  addText(shopAddress);
  addText(`Tel: ${shopPhone}`);
  addText(divider);

  // 4. Order Metadata (Left Aligned)
  add(ESCPOS_COMMANDS.ALIGN_LEFT);
  addText(formatTwoColumns('BILL NO:', sale.bill_number, cols));
  addText(formatTwoColumns('DATE:', new Date(sale.created_at || Date.now()).toLocaleString(), cols));
  addText(formatTwoColumns('TYPE:', `${String(sale.order_type || 'takeaway').toUpperCase()}${sale.table_number ? ` (${sale.table_number})` : ''}`, cols));
  if (sale.cashier_name) {
    addText(formatTwoColumns('CASHIER:', sale.cashier_name, cols));
  }
  if (sale.customer_name) {
    addText(formatTwoColumns('CUSTOMER:', `${sale.customer_name} ${sale.customer_phone ? `(${sale.customer_phone})` : ''}`, cols));
  }
  addText(divider);

  // 5. Line Items
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(formatTwoColumns('ITEM', 'AMOUNT (LKR)', cols));
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(divider);

  const items = Array.isArray(sale.items) ? sale.items : [];
  for (const item of items) {
    const qty = item.qty || item.quantity || 1;
    const itemTotal = fmtMoney(item.total || (item.price * qty));
    const itemHeader = `${qty}x ${item.name || item.product_name || 'Item'}`;
    addText(formatTwoColumns(itemHeader, itemTotal, cols));
    if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      for (const m of item.modifiers) {
        const modPrice = Number(m.price) > 0 ? ` (+${fmtMoney(m.price)})` : '';
        addText(`  + ${m.name}${modPrice}`);
      }
    }
    if (item.notes) {
      addText(`  * Note: ${item.notes}`);
    }
  }
  addText(divider);

  // 6. Subtotal & Financial Breakdown
  addText(formatTwoColumns('Subtotal:', fmtMoney(sale.subtotal), cols));
  if (sale.discount > 0) {
    addText(formatTwoColumns('Discount:', `-${fmtMoney(sale.discount)}`, cols));
  }
  if (sale.service_charge > 0) {
    addText(formatTwoColumns('Service Charge (10%):', `+${fmtMoney(sale.service_charge)}`, cols));
  }
  if (sale.sscl > 0) {
    addText(formatTwoColumns('SSCL Levy (2.5%):', `+${fmtMoney(sale.sscl)}`, cols));
  }
  if (sale.vat > 0) {
    addText(formatTwoColumns('VAT (18%):', `+${fmtMoney(sale.vat)}`, cols));
  }

  // 7. Grand Total (Emphasized & Large)
  addText(doubleDivider);
  add(ESCPOS_COMMANDS.BOLD_ON);
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(formatTwoColumns('TOTAL DUE:', `LKR ${fmtMoney(sale.total)}`, Math.floor(cols / 2)));
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(doubleDivider);

  // 8. Payments & Tender Breakdown
  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    addText('PAYMENTS & TENDER:');
    for (const p of sale.payments) {
      const pMethod = `${String(p.method || 'cash').toUpperCase()}${p.reference ? ` (${p.reference})` : ''}`;
      addText(formatTwoColumns(`  ${pMethod}:`, fmtMoney(p.amount), cols));
    }
  } else {
    addText(formatTwoColumns(`PAID (${String(sale.payment_method || 'CASH').toUpperCase()}):`, fmtMoney(sale.amount_received || sale.total), cols));
  }

  if (sale.payment_method === 'cash' && sale.amount_received > sale.total) {
    const change = Math.round((sale.amount_received - sale.total) * 100) / 100;
    addText(formatTwoColumns('CHANGE RETURNED:', fmtMoney(change), cols));
  }

  // 9. Loyalty Points Info
  if (sale.points_earned > 0 || sale.points_redeemed > 0) {
    addText(divider);
    if (sale.points_redeemed > 0) {
      addText(formatTwoColumns('Loyalty Pts Redeemed:', `-${sale.points_redeemed} pts`, cols));
    }
    if (sale.points_earned > 0) {
      addText(formatTwoColumns('Loyalty Pts Earned:', `+${sale.points_earned} pts`, cols));
    }
  }

  // 10. Footer & Paper Cut
  addText(divider);
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('Thank you for dining with us!');
  addText('Please retain receipt for your records.');
  addText('Powered by ADK Cafe POS');

  // Feed and cut paper
  add(ESCPOS_COMMANDS.FEED_3);
  add(ESCPOS_COMMANDS.CUT_PAPER);

  return concatBuffers(chunks);
}

/**
 * Compiles a binary ESC/POS buffer for an Interim Mid-Shift X-Report (without resetting the register)
 */
export function generateXReportESCPOS(report, options = {}) {
  const width = options.width || '80mm';
  const cols = width === '58mm' ? 32 : 42;
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);
  const encoder = new TextEncoder();
  const chunks = [];

  const add = (buf) => chunks.push(buf);
  const addText = (str) => chunks.push(encoder.encode(str + '\n'));
  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  add(ESCPOS_COMMANDS.INIT);
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(options.shopName || 'THE DAILY COUNTER');
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText('MID-SHIFT X-REPORT (INTERIM)');
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText('*** NOT A TAX INVOICE - REGISTER ACTIVE ***');
  addText(divider);

  add(ESCPOS_COMMANDS.ALIGN_LEFT);
  addText(formatTwoColumns('REPORT TYPE:', 'X-READING (INTERIM)', cols));
  addText(formatTwoColumns('DATE / TIME:', new Date().toLocaleString('en-LK'), cols));
  addText(formatTwoColumns('SHIFT OPENED:', new Date(report.openedAt).toLocaleString('en-LK'), cols));
  addText(formatTwoColumns('CASHIER:', report.cashier || 'Cashier', cols));
  addText(divider);

  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('SALES REVENUE SUMMARY');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Total Bills:', String(report.billsCount || 0), cols));
  addText(formatTwoColumns('Cash Sales:', `LKR ${fmtMoney(report.cashSales)}`, cols));
  if (report.cardSales) addText(formatTwoColumns('Card Sales:', `LKR ${fmtMoney(report.cardSales)}`, cols));
  if (report.qrSales) addText(formatTwoColumns('QR Sales:', `LKR ${fmtMoney(report.qrSales)}`, cols));
  addText(formatTwoColumns('Discounts Given:', `-${fmtMoney(report.discountsGiven)}`, cols));
  addText(divider);

  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('TAXES & LEVIES COLLECTED');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Service Charge (10%):', `+${fmtMoney(report.serviceChargeCollected)}`, cols));
  addText(formatTwoColumns('SSCL Levy (2.5%):', `+${fmtMoney(report.ssclCollected)}`, cols));
  addText(formatTwoColumns('VAT (18%):', `+${fmtMoney(report.vatCollected)}`, cols));
  addText(formatTwoColumns('Total Taxes:', `LKR ${fmtMoney(report.totalTaxesCollected)}`, cols));
  addText(divider);

  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('TILL DRAWER POSITION');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Opening Float:', `LKR ${fmtMoney(report.openingFloat)}`, cols));
  addText(formatTwoColumns('Net Adjustments (±):', `LKR ${fmtMoney(report.netAdjustments)}`, cols));
  addText(doubleDivider);
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(formatTwoColumns('EXPECTED CASH IN TILL:', `LKR ${fmtMoney(report.expectedCash)}`, cols));
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(doubleDivider);

  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('*** END OF INTERIM X-REPORT ***');
  add(ESCPOS_COMMANDS.FEED_3);
  add(ESCPOS_COMMANDS.CUT_PAPER);

  return concatBuffers(chunks);
}

/**
 * Compiles a binary ESC/POS buffer for an Official Resetting Z-Report (permanently sealing the shift)
 */
export function generateZReportESCPOS(report, options = {}) {
  const width = options.width || '80mm';
  const cols = width === '58mm' ? 32 : 42;
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);
  const encoder = new TextEncoder();
  const chunks = [];

  const add = (buf) => chunks.push(buf);
  const addText = (str) => chunks.push(encoder.encode(str + '\n'));
  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  add(ESCPOS_COMMANDS.INIT);
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(options.shopName || 'THE DAILY COUNTER');
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(`OFFICIAL Z-REPORT #${report.zReportNumber}`);
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText('*** REGISTER RESET & SHIFT SEALED ***');
  addText(divider);

  add(ESCPOS_COMMANDS.ALIGN_LEFT);
  addText(formatTwoColumns('Z-COUNTER NO:', String(report.zReportNumber), cols));
  addText(formatTwoColumns('CLOSED DATE/TIME:', new Date(report.closedAt).toLocaleString('en-LK'), cols));
  addText(formatTwoColumns('OPENED DATE/TIME:', new Date(report.openedAt).toLocaleString('en-LK'), cols));
  addText(formatTwoColumns('CASHIER:', report.cashier || 'Cashier', cols));
  addText(divider);

  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('FINAL REVENUE & TAX AUDIT');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Bills Settled:', String(report.billsCount || 0), cols));
  addText(formatTwoColumns('Cash Sales:', `LKR ${fmtMoney(report.cashSales)}`, cols));
  addText(formatTwoColumns('Discounts Given:', `-${fmtMoney(report.discountsGiven)}`, cols));
  addText(formatTwoColumns('Service Charge (10%):', `+${fmtMoney(report.serviceChargeCollected)}`, cols));
  addText(formatTwoColumns('SSCL Levy (2.5%):', `+${fmtMoney(report.ssclCollected)}`, cols));
  addText(formatTwoColumns('VAT (18%):', `+${fmtMoney(report.vatCollected)}`, cols));
  addText(formatTwoColumns('Total Tax Collected:', `LKR ${fmtMoney(report.totalTaxesCollected)}`, cols));
  addText(divider);

  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('BLIND CASH RECONCILIATION');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Opening Float:', `LKR ${fmtMoney(report.openingFloat)}`, cols));
  addText(formatTwoColumns('Net Adjustments (±):', `LKR ${fmtMoney(report.netAdjustments)}`, cols));
  addText(formatTwoColumns('Expected Cash:', `LKR ${fmtMoney(report.expectedCash)}`, cols));
  addText(formatTwoColumns('Actual Counted Cash:', `LKR ${fmtMoney(report.actualCountedCash)}`, cols));
  addText(doubleDivider);

  const variance = report.variance || 0;
  const varStatus = variance === 0 ? 'BALANCED' : variance > 0 ? `OVER (+${fmtMoney(variance)})` : `SHORT (${fmtMoney(variance)})`;
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(formatTwoColumns('TILL VARIANCE:', varStatus, cols));
  add(ESCPOS_COMMANDS.BOLD_OFF);

  if (report.varianceReason) {
    addText(`Variance Reason: ${report.varianceReason}`);
  }
  addText(doubleDivider);

  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('*** OFFICIAL TAX AUDIT RECORD ***');
  addText('Register totals have been reset.');
  add(ESCPOS_COMMANDS.FEED_3);
  add(ESCPOS_COMMANDS.CUT_PAPER);

  return concatBuffers(chunks);
}


/**
 * Returns standalone ESC/POS command to kick the cash drawer.
 */
export function generateDrawerKickESCPOS() {
  return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]);
}

/**
 * Compiles a comprehensive ESC/POS hardware diagnostic self-test printout.
 * Verifies character encoding, bolding, sizing, alignments, margins, and paper cutting.
 */
export function generateDiagnosticTestESCPOS({
  width = '80mm',
  shopName = 'ADK Cafe',
  printerIp = null,
  pulseDrawer = false
} = {}) {
  const is58mm = width === '58mm' || width === 58;
  const cols = is58mm ? 32 : 48;
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);

  const chunks = [];
  const add = (cmd) => chunks.push(cmd);
  const encoder = new TextEncoder();
  const addText = (str) => add(encoder.encode(str + '\n'));

  // 1. Initialize
  add(ESCPOS_COMMANDS.INIT);

  // 2. Optional cash drawer pulse
  if (pulseDrawer) {
    add(ESCPOS_COMMANDS.DRAWER_KICK_PIN2);
  }

  // 3. Header
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(shopName);
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('HARDWARE DIAGNOSTIC TEST');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(new Date().toLocaleString('en-LK'));
  addText(doubleDivider);

  // 4. Alignment Test
  add(ESCPOS_COMMANDS.ALIGN_LEFT);
  addText('[LEFT ALIGNED TEXT]');
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('[CENTER ALIGNED TEXT]');
  add(ESCPOS_COMMANDS.ALIGN_RIGHT);
  addText('[RIGHT ALIGNED TEXT]');
  add(ESCPOS_COMMANDS.ALIGN_LEFT);
  addText(divider);

  // 5. Typography & Font Weights
  addText('Normal font: 1234567890 ABCDEFGHIJKLMNOP');
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText('Bold font:   1234567890 ABCDEFGHIJKLMNOP');
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(divider);

  // 6. Two-Column Margin Alignment (48 col or 32 col)
  add(ESCPOS_COMMANDS.BOLD_ON);
  addText(`COLUMN MARGIN TEST (${cols} COLS):`);
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(formatTwoColumns('Left Margin Text', 'Right Margin Text', cols));
  addText(formatTwoColumns('Item 01: Espresso', 'LKR 450.00', cols));
  addText(formatTwoColumns('Item 02: Chicken Burger', 'LKR 950.00', cols));
  addText(formatTwoColumns('Subtotal Amount', 'LKR 1,400.00', cols));
  addText(divider);

  // 7. Diagnostics Info
  addText(`Paper Profile:     ${is58mm ? '58mm (32 Col)' : '80mm (48 Col)'}`);
  addText(`Printer Interface: ${printerIp ? `TCP ${printerIp}:9100` : 'Direct WebUSB / Serial'}`);
  addText(`Cash Drawer Pulse: ${pulseDrawer ? 'ACTIVE (Pin 2)' : 'OFF'}`);
  addText(doubleDivider);

  // 8. Footer & Cut
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('*** ESC/POS SELF-TEST PASSED ***');
  addText('Thermal printer hardware is operational.');
  add(ESCPOS_COMMANDS.FEED_3);
  add(ESCPOS_COMMANDS.CUT_PAPER);

  return concatBuffers(chunks);
}
