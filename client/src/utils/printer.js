/**
 * ESC/POS Client Direct Printing Engine: WebUSB, WebSerial & Network Bridge
 */

const STORAGE_KEY = 'pos_printer_config';

export const DEFAULT_PRINTER_CONFIG = {
  connectionType: 'network', // 'network' | 'webusb' | 'webserial' | 'browser_dialog'
  printerIp: '192.168.1.200',
  printerPort: 9100,
  paperWidth: '80mm', // '80mm' | '58mm'
  autoDrawerKick: true,
  headerText: 'Nila Cafe',
  subHeaderText: 'Specialty Coffee & Artisanal Kitchen',
  footerText: 'Thank you for dining with us! Please come again.'
};

export function getStoredPrinterConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_CONFIG;
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function saveStoredPrinterConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export function isWebUSBSupported() {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Prompts user to pair a USB Thermal Printer via WebUSB
 */
export async function pairWebUSBPrinter() {
  if (!isWebUSBSupported()) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
  }

  // Request USB device (Printers standard USB class is 7)
  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7 }]
    });
    return device;
  } catch (err) {
    // Fallback: prompt without class filter for USB-to-Serial adapters
    const device = await navigator.usb.requestDevice({ filters: [] });
    return device;
  }
}

/**
 * Transmits raw binary buffer directly to paired WebUSB printer
 */
export async function printDirectWebUSB(device, buffer) {
  if (!device) throw new Error('No WebUSB device connected.');

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Claim interface 0
  await device.claimInterface(0);

  // Find OUT endpoint for bulk transfer
  const iface = device.configuration.interfaces[0];
  const alternate = iface.alternates[0];
  const outEndpoint = alternate.endpoints.find(e => e.direction === 'out');

  if (!outEndpoint) {
    throw new Error('No OUT endpoint found on USB printer.');
  }

  const uint8 = buffer instanceof Uint8Array ? buffer : base64ToUint8Array(buffer);
  await device.transferOut(outEndpoint.endpointNumber, uint8);
}

/**
 * Prompts user to pair a Serial/COM Port Thermal Printer
 */
export async function pairWebSerialPrinter() {
  if (!isWebSerialSupported()) {
    throw new Error('WebSerial is not supported in this browser. Use Chrome or Edge.');
  }
  const port = await navigator.serial.requestPort();
  return port;
}

/**
 * Transmits raw binary buffer directly to paired Serial/COM printer
 */
export async function printDirectWebSerial(port, buffer, baudRate = 9600) {
  if (!port) throw new Error('No WebSerial port connected.');

  if (!port.readable) {
    await port.open({ baudRate: Number(baudRate) || 9600 });
  }

  const writer = port.writable.getWriter();
  const uint8 = buffer instanceof Uint8Array ? buffer : base64ToUint8Array(buffer);
  await writer.write(uint8);
  writer.releaseLock();
}
