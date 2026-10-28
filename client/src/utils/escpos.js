/**
 * Client-Side ESC/POS Thermal Receipt Printer Protocol & Hardware Cash Drawer Pulse
 * Supports WebUSB, WebSerial, Direct Socket, and Downloadable Binary Payloads.
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

export const ESCPOS_COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x11]),
  NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),
  LINE_FEED: new Uint8Array([LF]),
  FEED_3: new Uint8Array([ESC, 0x64, 0x03]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x41, 0x03]),
  DRAWER_KICK_PIN2: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]),
  DRAWER_KICK_PIN5: new Uint8Array([ESC, 0x70, 0x01, 0x19, 0xFA])
};

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

function fmtMoney(amount) {
  return Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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

  // 1. Initialize
  add(ESCPOS_COMMANDS.INIT);

  // 2. Pulse Drawer (Optional)
  if (pulseDrawer) {
    add(ESCPOS_COMMANDS.DRAWER_KICK_PIN2);
  }

  // 3. Header
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  add(ESCPOS_COMMANDS.BOLD_ON);
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(shopName);
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);

  addText(shopAddress);
  addText(`Tel: ${shopPhone}`);
  addText(divider);

  // 4. Metadata
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

  // 5. Items
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
    if (item.notes) {
      addText(`  * Note: ${item.notes}`);
    }
  }
  addText(divider);

  // 6. Subtotal & Taxes
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

  // 7. Grand Total
  addText(doubleDivider);
  add(ESCPOS_COMMANDS.BOLD_ON);
  add(ESCPOS_COMMANDS.DOUBLE_SIZE_ON);
  addText(formatTwoColumns('TOTAL DUE:', `LKR ${fmtMoney(sale.total)}`, Math.floor(cols / 2)));
  add(ESCPOS_COMMANDS.NORMAL_SIZE);
  add(ESCPOS_COMMANDS.BOLD_OFF);
  addText(doubleDivider);

  // 8. Tender
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

  // 9. Loyalty Points
  if (sale.points_earned > 0 || sale.points_redeemed > 0) {
    addText(divider);
    if (sale.points_redeemed > 0) {
      addText(formatTwoColumns('Loyalty Pts Redeemed:', `-${sale.points_redeemed} pts`, cols));
    }
    if (sale.points_earned > 0) {
      addText(formatTwoColumns('Loyalty Pts Earned:', `+${sale.points_earned} pts`, cols));
    }
  }

  // 10. Footer & Cut
  addText(divider);
  add(ESCPOS_COMMANDS.ALIGN_CENTER);
  addText('Thank you for dining with us!');
  addText('Please retain receipt for your records.');
  addText('Softwared by ADK Software Solutions');

  add(ESCPOS_COMMANDS.FEED_3);
  add(ESCPOS_COMMANDS.CUT_PAPER);

  return concatBuffers(chunks);
}

export function generateDrawerKickESCPOS() {
  return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]);
}

/**
 * Downloads binary ESC/POS buffer as a raw .bin file for print spoolers
 */
export function downloadRawESCPOSFile(buffer, filename = 'receipt.bin') {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sends ESC/POS binary data to thermal printer via WebSerial / WebUSB if supported
 */
export async function printDirectWebSerial(buffer) {
  if (typeof navigator !== 'undefined' && 'serial' in navigator) {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();
      await writer.write(buffer);
      writer.releaseLock();
      await port.close();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'WebSerial not supported in this browser' };
}
