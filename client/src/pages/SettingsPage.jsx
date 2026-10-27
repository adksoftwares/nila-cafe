import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Store,
  Printer,
  Usb,
  Wifi,
  Zap,
  Check,
  RefreshCw,
  Save,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  getStoredPrinterConfig,
  saveStoredPrinterConfig,
  isWebUSBSupported,
  isWebSerialSupported,
  pairWebUSBPrinter,
  printDirectWebUSB,
  pairWebSerialPrinter,
  printDirectWebSerial
} from '../utils/printer.js';

export default function SettingsPage({
  user,
  shopName,
  apiMode,
  api,
  onFlash,
  onLogout
}) {
  const admin = user.role === 'admin';

  // Printer Settings State
  const [config, setConfig] = useState(getStoredPrinterConfig);
  const [testingPrint, setTestingPrint] = useState(false);
  const [kickingDrawer, setKickingDrawer] = useState(false);

  // Hardware Device Handles
  const [usbDevice, setUsbDevice] = useState(null);
  const [serialPort, setSerialPort] = useState(null);

  const webUsbAvailable = isWebUSBSupported();
  const webSerialAvailable = isWebSerialSupported();

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = (e) => {
    e?.preventDefault();
    saveStoredPrinterConfig(config);
    onFlash?.('Hardware printer settings saved successfully.', 'success');
  };

  // Pair WebUSB device
  const handleConnectWebUSB = async () => {
    try {
      const device = await pairWebUSBPrinter();
      setUsbDevice(device);
      onFlash?.(`Paired USB Printer: ${device.productName || 'Thermal POS Printer'}`, 'success');
    } catch (err) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('canceled')) {
        onFlash?.(err.message || 'WebUSB connection failed.', 'error');
      }
    }
  };

  // Pair WebSerial device
  const handleConnectWebSerial = async () => {
    try {
      const port = await pairWebSerialPrinter();
      setSerialPort(port);
      onFlash?.('Connected to Serial/COM Thermal Printer.', 'success');
    } catch (err) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('canceled')) {
        onFlash?.(err.message || 'WebSerial connection failed.', 'error');
      }
    }
  };

  // Diagnostic Test Print
  const handleTestPrint = async () => {
    setTestingPrint(true);
    try {
      const res = await api('/printer/test-print', {
        method: 'POST',
        body: JSON.stringify({
          width: config.paperWidth === '58mm' ? 58 : 80,
          pulseDrawer: config.autoDrawerKick,
          printerIp: config.connectionType === 'network' ? config.printerIp : null,
          printerPort: Number(config.printerPort) || 9100
        })
      });

      if (res.success) {
        // If client-direct WebUSB or WebSerial, send the compiled ESC/POS payload
        if (config.connectionType === 'webusb') {
          if (!usbDevice) {
            onFlash?.('Please pair your WebUSB printer first using the button below.', 'warning');
            return;
          }
          await printDirectWebUSB(usbDevice, res.escposBase64);
          onFlash?.('Test receipt printed via direct WebUSB! 🖨️', 'success');
        } else if (config.connectionType === 'webserial') {
          if (!serialPort) {
            onFlash?.('Please pair your Serial/COM port first using the button below.', 'warning');
            return;
          }
          await printDirectWebSerial(serialPort, res.escposBase64);
          onFlash?.('Test receipt printed via Serial/COM port! 🖨️', 'success');
        } else if (res.transmitted) {
          onFlash?.(`Test printout sent to network printer (${config.printerIp}:9100)! 🖨️`, 'success');
        } else {
          onFlash?.('Diagnostic ESC/POS buffer compiled successfully.', 'success');
        }
      }
    } catch (err) {
      onFlash?.(err.message || 'Test print failed.', 'error');
    } finally {
      setTestingPrint(false);
    }
  };

  // Test Cash Drawer Kick Pulse
  const handleTestDrawerKick = async () => {
    setKickingDrawer(true);
    try {
      const res = await api('/printer/open-drawer', { method: 'POST' });
      if (res.success) {
        if (config.connectionType === 'webusb' && usbDevice && res.commandHex) {
          const kickBytes = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
          await printDirectWebUSB(usbDevice, kickBytes);
        }
        onFlash?.('Cash drawer kick pulse sent! ⚡', 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Cash drawer kick failed.', 'error');
    } finally {
      setKickingDrawer(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES & HARDWARE</span>
          <h1>Settings & Hardware</h1>
          <p>Configure ESC/POS thermal receipt printers, cash drawers, and system preferences.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ================= HARDWARE PRINTER & DRAWER CONFIG ================= */}
        <div className="table-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', color: 'var(--blue)' }}>
                <Printer size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                  ESC/POS Thermal Receipt Printer & Cash Drawer
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Supports standard 80mm and 58mm thermal printers with automatic cash drawer kick pulses
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleTestDrawerKick}
                disabled={kickingDrawer}
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Zap size={14} color="#d97706" /> {kickingDrawer ? 'Kicking...' : 'Test Drawer Kick'}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleTestPrint}
                disabled={testingPrint}
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={14} className={testingPrint ? 'spin' : ''} />
                {testingPrint ? 'Printing Test...' : 'Test Print Receipt'}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleSaveConfig}
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Save size={14} /> Save Printer Settings
              </button>
            </div>
          </div>

          {/* Connection Type Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
              Hardware Connection Interface:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                {
                  id: 'network',
                  title: 'Network / LAN Printer',
                  desc: 'TCP Raw Port 9100 over WiFi / Ethernet',
                  icon: Wifi
                },
                {
                  id: 'webusb',
                  title: 'Direct WebUSB',
                  desc: webUsbAvailable ? 'Driverless USB connection' : 'Not supported in this browser',
                  icon: Usb,
                  disabled: !webUsbAvailable
                },
                {
                  id: 'webserial',
                  title: 'Serial / COM Port',
                  desc: webSerialAvailable ? 'RS-232 / Virtual COM port' : 'Not supported in this browser',
                  icon: Sliders,
                  disabled: !webSerialAvailable
                },
                {
                  id: 'browser_dialog',
                  title: 'System Print Dialog',
                  desc: 'Standard browser print preview',
                  icon: Printer
                }
              ].map(opt => {
                const isSelected = config.connectionType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleConfigChange('connectionType', opt.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--blue)' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : opt.disabled ? '#f8fafc' : '#fff',
                      opacity: opt.disabled ? 0.6 : 1,
                      cursor: opt.disabled ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <opt.icon size={16} color={isSelected ? 'var(--blue)' : '#64748b'} />
                      <strong style={{ fontSize: '13px', color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                        {opt.title}
                      </strong>
                    </div>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Network Connection Parameters */}
          {config.connectionType === 'network' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Printer IP Address:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.200"
                  value={config.printerIp}
                  onChange={e => handleConfigChange('printerIp', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                  TCP Port:
                </label>
                <input
                  type="number"
                  placeholder="9100"
                  value={config.printerPort}
                  onChange={e => handleConfigChange('printerPort', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Paper Width:
                </label>
                <select
                  value={config.paperWidth}
                  onChange={e => handleConfigChange('paperWidth', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="80mm">80mm (48 Cols)</option>
                  <option value="58mm">58mm (32 Cols)</option>
                </select>
              </div>
            </div>
          )}

          {/* WebUSB Connection Parameters */}
          {config.connectionType === 'webusb' && (
            <div
              style={{
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                  {usbDevice ? `Connected: ${usbDevice.productName || 'USB Thermal Printer'}` : 'No WebUSB Device Paired'}
                </strong>
                <small style={{ fontSize: '11px', color: '#64748b' }}>
                  Direct USB control without installing vendor printer drivers.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={config.paperWidth}
                  onChange={e => handleConfigChange('paperWidth', e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="80mm">80mm (48 Cols)</option>
                  <option value="58mm">58mm (32 Cols)</option>
                </select>

                <button
                  type="button"
                  className="secondary-btn small"
                  onClick={handleConnectWebUSB}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Usb size={14} /> {usbDevice ? 'Re-pair Device' : 'Pair USB Printer'}
                </button>
              </div>
            </div>
          )}

          {/* WebSerial Connection Parameters */}
          {config.connectionType === 'webserial' && (
            <div
              style={{
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                  {serialPort ? 'Connected: Serial COM Port Active' : 'No Serial Port Paired'}
                </strong>
                <small style={{ fontSize: '11px', color: '#64748b' }}>
                  Standard RS-232 or USB-Serial baud 9600 transfer.
                </small>
              </div>

              <button
                type="button"
                className="secondary-btn small"
                onClick={handleConnectWebSerial}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Sliders size={14} /> {serialPort ? 'Change Port' : 'Select COM Port'}
              </button>
            </div>
          )}

          {/* Receipt Custom Header & Footer Formatting */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                Receipt Header Brand:
              </label>
              <input
                type="text"
                placeholder="e.g. ADK Cafe"
                value={config.headerText}
                onChange={e => handleConfigChange('headerText', e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                Sub-Header / Tax ID:
              </label>
              <input
                type="text"
                placeholder="e.g. Colombo 03 · VAT: 10482910"
                value={config.subHeaderText}
                onChange={e => handleConfigChange('subHeaderText', e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                Receipt Footer Message:
              </label>
              <input
                type="text"
                placeholder="e.g. Thank you for visiting!"
                value={config.footerText}
                onChange={e => handleConfigChange('footerText', e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          {/* Auto Cash Drawer Toggle */}
          <div style={{ paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={config.autoDrawerKick}
                onChange={e => handleConfigChange('autoDrawerKick', e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>
                <strong>Automatically kick cash drawer on cash checkout</strong>
                <small style={{ display: 'block', color: '#64748b' }}>
                  Sends RJ11 Pin 2 electrical pulse (0x1B 0x70 0x00) whenever a cash or mixed-cash sale completes
                </small>
              </span>
            </label>
          </div>
        </div>

        {/* ================= GENERAL WORKSPACE PREFERENCES ================= */}
        <div className="settings-grid">
          <div className="setting-card">
            <div className="setting-icon">
              <Users size={19} />
            </div>
            <div>
              <h3>User Account</h3>
              <p>
                {user.name} · {user.email}
              </p>
              <span className="pill">{user.role}</span>
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-icon">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h3>Session & Security</h3>
              <p>
                Session active on this workstation. Sign out to terminate access.
              </p>
              <button className="secondary-btn small" onClick={onLogout}>
                Sign out
              </button>
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-icon">
              <Store size={19} />
            </div>
            <div>
              <h3>Cafe Workspace Details</h3>
              <p>
                {admin ? 'Platform-wide Multi-Tenant Management' : `${shopName} · Colombo, Sri Lanka`}
              </p>
              <p className="muted">
                Branch profile editing & tax ID configuration available in admin console.
              </p>
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-icon">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h3>Data Connectivity Mode</h3>
              <p>
                {apiMode === 'connected'
                  ? 'Connected to PostgreSQL Database'
                  : apiMode === 'offline'
                  ? 'Offline / API Server Unavailable'
                  : 'Local Demo Data Active'}
              </p>
              <p className="muted">
                {apiMode === 'connected'
                  ? 'Real-time database persistence and tenant isolation are active.'
                  : 'Transactions are stored in local workstation storage only.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
