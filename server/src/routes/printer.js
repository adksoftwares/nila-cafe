import { Router } from 'express';
import net from 'node:net';
import { auth, roles } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
  generateDrawerKickESCPOS,
  generateReceiptESCPOS,
  generateXReportESCPOS,
  generateZReportESCPOS
} from '../utils/escpos.js';

const router = Router();

/**
 * Transmits a raw binary buffer to a network thermal printer over TCP port 9100.
 */
function sendToNetworkPrinter(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.connect(port, host, () => {
      socket.write(Buffer.from(buffer), () => {
        socket.end();
        resolve({ success: true, host, port });
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout connecting to thermal printer at ${host}:${port}`));
    });
  });
}

// Printer: Status & Configuration
router.get('/status', auth, (req, res) => {
  const printerIp = process.env.PRINTER_IP || null;
  const printerPort = Number(process.env.PRINTER_PORT || 9100);
  const paperWidth = Number(process.env.PRINTER_PAPER_WIDTH || 80);

  res.json({
    status: 'ok',
    configured: Boolean(printerIp),
    host: printerIp,
    port: printerPort,
    paperWidth,
    mode: printerIp ? 'hardware-tcp' : 'client-driver-mode'
  });
});

// Printer: Hardware Cash Drawer Kick Pulse
router.post('/open-drawer', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const kickCommand = generateDrawerKickESCPOS();
  const printerIp = process.env.PRINTER_IP;
  const printerPort = Number(process.env.PRINTER_PORT || 9100);

  // Record audit log for security & till monitoring
  await recordAuditEvent({
    shopId: req.user.shop_id,
    userId: req.user.sub,
    userName: req.user.name || 'User',
    userRole: req.user.role,
    action: 'DRAWER_KICK',
    category: 'fiscal',
    severity: 'danger',
    entityType: 'drawer',
    details: {
      method: printerIp ? 'hardware-tcp' : 'client-direct',
      reason: 'Manual cash drawer kick pulse triggered from register UI'
    }
  });

  try {
    if (printerIp) {
      await sendToNetworkPrinter(printerIp, printerPort, kickCommand);
      return res.json({
        success: true,
        message: 'Cash drawer kick pulse sent to network printer.',
        method: 'hardware-tcp'
      });
    }

    // Return binary command for WebUSB / client driver
    res.json({
      success: true,
      message: 'Cash drawer kick command generated.',
      commandHex: Buffer.from(kickCommand).toString('hex'),
      method: 'client-direct'
    });
  } catch (err) {
    res.status(502).json({
      error: `Could not send kick pulse to printer: ${err.message}`,
      fallbackCommandHex: Buffer.from(kickCommand).toString('hex')
    });
  }
});

// Printer: Print Thermal Receipt ESC/POS
router.post('/print-receipt', auth, async (req, res) => {
  const { sale, paperWidth = 80, pulseDrawer = false } = req.body;

  if (!sale || !sale.bill_number) {
    return res.status(400).json({ error: 'Valid sale object with bill_number is required.' });
  }

  const buffer = generateReceiptESCPOS(sale, {
    paperWidth: Number(paperWidth) || 80,
    pulseDrawer: Boolean(pulseDrawer),
    shopName: 'Nila Cafe',
    shopAddress: 'Colombo, Sri Lanka',
    shopPhone: '+94 77 123 4567'
  });

  const printerIp = process.env.PRINTER_IP;
  const printerPort = Number(process.env.PRINTER_PORT || 9100);

  try {
    if (printerIp) {
      await sendToNetworkPrinter(printerIp, printerPort, buffer);
      return res.json({
        success: true,
        message: 'Receipt sent to thermal network printer.',
        bytesPrinted: buffer.length
      });
    }

    res.json({
      success: true,
      message: 'Receipt ESC/POS buffer compiled successfully.',
      bytesLength: buffer.length,
      escposHex: Buffer.from(buffer).toString('hex'),
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  } catch (err) {
    res.status(502).json({
      error: `Network thermal printer error: ${err.message}`,
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  }
});

// Printer: Print Interim Mid-Shift X-Report
router.post('/print-x-report', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const { xReport, paperWidth = 80 } = req.body;
  if (!xReport) {
    return res.status(400).json({ error: 'Valid xReport object is required.' });
  }

  const buffer = generateXReportESCPOS(xReport, {
    width: paperWidth === 58 ? '58mm' : '80mm',
    shopName: 'Nila Cafe'
  });

  const printerIp = process.env.PRINTER_IP;
  const printerPort = Number(process.env.PRINTER_PORT || 9100);

  try {
    if (printerIp) {
      await sendToNetworkPrinter(printerIp, printerPort, buffer);
      return res.json({
        success: true,
        message: 'Interim X-Report sent to thermal network printer.',
        bytesPrinted: buffer.length
      });
    }

    res.json({
      success: true,
      message: 'X-Report ESC/POS buffer compiled successfully.',
      bytesLength: buffer.length,
      escposHex: Buffer.from(buffer).toString('hex'),
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  } catch (err) {
    res.status(502).json({
      error: `Printer transmission error: ${err.message}`,
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  }
});

// Printer: Print Official Resetting Z-Report
router.post('/print-z-report', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const { zReport, paperWidth = 80 } = req.body;
  if (!zReport) {
    return res.status(400).json({ error: 'Valid zReport object is required.' });
  }

  const buffer = generateZReportESCPOS(zReport, {
    width: paperWidth === 58 ? '58mm' : '80mm',
    shopName: 'Nila Cafe'
  });

  const printerIp = process.env.PRINTER_IP;
  const printerPort = Number(process.env.PRINTER_PORT || 9100);

  try {
    if (printerIp) {
      await sendToNetworkPrinter(printerIp, printerPort, buffer);
      return res.json({
        success: true,
        message: 'Official Z-Report sent to thermal network printer.',
        bytesPrinted: buffer.length
      });
    }

    res.json({
      success: true,
      message: 'Z-Report ESC/POS buffer compiled successfully.',
      bytesLength: buffer.length,
      escposHex: Buffer.from(buffer).toString('hex'),
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  } catch (err) {
    res.status(502).json({
      error: `Printer transmission error: ${err.message}`,
      escposBase64: Buffer.from(buffer).toString('base64')
    });
  }
});

export default router;
