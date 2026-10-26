/**
 * Calculates itemized taxes and charges for POS orders (Sri Lankan Tax Standards)
 *
 * @param {Object} params
 * @param {number} params.subtotal
 * @param {number} params.discount
 * @param {string} params.orderType - 'dining' | 'takeaway' | 'delivery'
 * @param {Object} [params.taxConfig]
 * @returns {Object} itemized breakdown
 */
export function calculateBillTaxes({
  subtotal = 0,
  discount = 0,
  orderType = 'dining',
  taxConfig = {}
}) {
  const round = (val) => Math.round(Number(val || 0) * 100) / 100;

  const rawSubtotal = Math.max(0, round(subtotal));
  const effectiveDiscount = Math.min(rawSubtotal, Math.max(0, round(discount)));
  const netSubtotal = round(rawSubtotal - effectiveDiscount);

  // 1. Service Charge: Exclusively on 'dining' orders
  const scEnabled = taxConfig.service_charge_enabled !== false;
  const scRate = Number.isFinite(Number(taxConfig.service_charge_rate))
    ? Number(taxConfig.service_charge_rate)
    : 10.0;
  const serviceCharge = (orderType === 'dining' && scEnabled && scRate > 0)
    ? round(netSubtotal * (scRate / 100))
    : 0;

  // 2. SSCL: 2.5% on liable turnover (netSubtotal + serviceCharge)
  const ssclEnabled = taxConfig.sscl_enabled !== false;
  const ssclRate = Number.isFinite(Number(taxConfig.sscl_rate))
    ? Number(taxConfig.sscl_rate)
    : 2.5;
  const taxableBase = round(netSubtotal + serviceCharge);
  const sscl = (ssclEnabled && ssclRate > 0)
    ? round(taxableBase * (ssclRate / 100))
    : 0;

  // 3. VAT: 18% on (taxableBase + SSCL)
  const vatEnabled = taxConfig.vat_enabled !== false;
  const vatRate = Number.isFinite(Number(taxConfig.vat_rate))
    ? Number(taxConfig.vat_rate)
    : 18.0;
  const vatBase = round(taxableBase + sscl);
  const vat = (vatEnabled && vatRate > 0)
    ? round(vatBase * (vatRate / 100))
    : 0;

  const totalTaxes = round(serviceCharge + sscl + vat);
  const grandTotal = round(netSubtotal + totalTaxes);

  return {
    subtotal: rawSubtotal,
    discount: effectiveDiscount,
    netSubtotal,
    serviceCharge,
    sscl,
    vat,
    totalTaxes,
    grandTotal
  };
}
