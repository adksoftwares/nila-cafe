export function money(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function exportCSV(sales) {
  const rows = [
    ['Bill number', 'Date', 'Order type', 'Subtotal', 'Discount', 'Service Charge', 'SSCL', 'VAT', 'Total'],
    ...sales.map(s => [
      s.bill_number,
      s.created_at,
      s.order_type,
      s.subtotal,
      s.discount,
      s.service_charge || 0,
      s.sscl || 0,
      s.vat || 0,
      s.total
    ])
  ];
  const blob = new Blob(
    [rows.map(r => r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\n')],
    { type: 'text/csv;charset=utf-8;' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `adk-cafe-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Compiles and triggers an automatic browser download of a formatted receipt text file (.txt)
 * @param {object} receipt - Completed transaction sale record
 * @param {string} [shopName='ADK Cafe'] - Name of the store
 */
export function downloadReceiptText(receipt, shopName = 'ADK Cafe') {
  if (!receipt) return;
  const divider = '------------------------------------------';
  const doubleDivider = '==========================================';
  const cols = 42;

  const centerText = (str) => {
    const s = String(str || '').trim();
    if (s.length >= cols) return s.slice(0, cols);
    const leftPad = Math.floor((cols - s.length) / 2);
    return ' '.repeat(leftPad) + s;
  };

  const lines = [
    doubleDivider,
    centerText(shopName),
    centerText('Specialty Coffee & Artisanal Food'),
    centerText('Galle Road, Colombo 03, Sri Lanka'),
    centerText('Tel: +94 77 123 4567'),
    doubleDivider,
    `Bill Number  : ${receipt.bill_number}`,
    `Date & Time  : ${new Date(receipt.created_at || Date.now()).toLocaleString()}`,
    `Order Type   : ${(receipt.order_type || 'takeaway').toUpperCase()}${receipt.table_number ? ' (' + receipt.table_number + ')' : ''}`,
    ...(receipt.customer_name ? [`Customer     : ${receipt.customer_name}${receipt.customer_phone ? ' (' + receipt.customer_phone + ')' : ''}`] : []),
    divider,
    'ITEM                       QTY       TOTAL',
    divider,
    ...(receipt.items || []).map(item => {
      const name = (item.name || 'Item').padEnd(24).slice(0, 24);
      const qty = String(item.qty || 1).padStart(3);
      const total = money(item.total || 0).padStart(13);
      const note = item.notes ? `\n  * Prep Note: ${item.notes}` : '';
      return `${name}  ${qty}  ${total}${note}`;
    }),
    divider,
    `Subtotal                         : ${money(receipt.subtotal)}`,
    ...(receipt.discount > 0 ? [`Discount                         : -${money(receipt.discount)}`] : []),
    ...(receipt.service_charge > 0 ? [`Service Charge (10%)             : +${money(receipt.service_charge)}`] : []),
    ...(receipt.sscl > 0 ? [`SSCL (2.5%)                      : +${money(receipt.sscl)}`] : []),
    ...(receipt.vat > 0 ? [`VAT (18%)                        : +${money(receipt.vat)}`] : []),
    doubleDivider,
    `TOTAL AMOUNT                     : ${money(receipt.total)}`,
    doubleDivider,
    `Payment Method                   : ${(receipt.payment_method || 'cash').toUpperCase()}`,
    ...(receipt.amount_received > receipt.total ? [
      `Amount Tendered                  : ${money(receipt.amount_received)}`,
      `Change Returned                  : ${money(receipt.amount_received - receipt.total)}`
    ] : []),
    ...(receipt.points_earned > 0 ? [`Loyalty Points Earned            : +${receipt.points_earned} pts`] : []),
    ...(receipt.points_redeemed > 0 ? [`Loyalty Points Redeemed          : -${receipt.points_redeemed} pts`] : []),
    divider,
    centerText('Thank you for dining with ADK Cafe!'),
    centerText('Please retain receipt for your records.'),
    centerText('Softwared by ADK Software Solutions'),
    doubleDivider,
    '\n'
  ];

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${receipt.bill_number}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
