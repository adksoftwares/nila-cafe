/**
 * Calculates itemized taxes and charges for a POS order according to Sri Lankan tax compliance.
 *
 * Sri Lanka Hospitality Tax Standard:
 * 1. Service Charge: Configurable (default 10%), applied strictly to 'dining' orders.
 * 2. SSCL (Social Security Contribution Levy): 2.5% on liable turnover (net subtotal + service charge).
 * 3. VAT (Value Added Tax): 18% on taxable turnover (net subtotal + service charge + SSCL).
 *
 * @param {Object} params
 * @param {number} params.subtotal - Total order subtotal before discounts
 * @param {number} params.discount - Total discounts applied (manual + promotions + loyalty)
 * @param {string} params.orderType - 'dining' | 'takeaway' | 'delivery'
 * @param {Object} [params.taxConfig] - Shop tax settings
 * @param {boolean} [params.taxConfig.service_charge_enabled=true]
 * @param {number} [params.taxConfig.service_charge_rate=10.0]
 * @param {boolean} [params.taxConfig.sscl_enabled=true]
 * @param {number} [params.taxConfig.sscl_rate=2.5]
 * @param {boolean} [params.taxConfig.vat_enabled=true]
 * @param {number} [params.taxConfig.vat_rate=18.0]
 * @returns {Object} Complete itemized tax breakdown and grand total
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

  // 1. Service Charge (Exclusively on dining orders)
  const scEnabled = taxConfig.service_charge_enabled !== false;
  const scRate = Number.isFinite(Number(taxConfig.service_charge_rate))
    ? Number(taxConfig.service_charge_rate)
    : 10.0;
  const serviceCharge = (orderType === 'dining' && scEnabled && scRate > 0)
    ? round(netSubtotal * (scRate / 100))
    : 0;

  // 2. SSCL (2.5% on liable turnover = netSubtotal + serviceCharge)
  const ssclEnabled = taxConfig.sscl_enabled !== false;
  const ssclRate = Number.isFinite(Number(taxConfig.sscl_rate))
    ? Number(taxConfig.sscl_rate)
    : 2.5;
  const taxableBase = round(netSubtotal + serviceCharge);
  const sscl = (ssclEnabled && ssclRate > 0)
    ? round(taxableBase * (ssclRate / 100))
    : 0;

  // 3. VAT (18% on taxableBase + SSCL)
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
