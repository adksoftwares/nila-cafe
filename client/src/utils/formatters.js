export function money(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function exportCSV(sales) {
  const rows = [
    ['Bill number', 'Date', 'Order type', 'Subtotal', 'Discount', 'Total'],
    ...sales.map(s => [s.bill_number, s.created_at, s.order_type, s.subtotal, s.discount, s.total])
  ];
  const blob = new Blob(
    [rows.map(r => r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\n')],
    { type: 'text/csv;charset=utf-8;' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nila-cafe-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
