import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MessageSquare, RefreshCw, CheckCircle, AlertCircle, LogOut, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { getWhatsAppStatus, reconnectWhatsApp, logoutWhatsApp, type WhatsAppStatusResponse } from '../api/whatsapp.api';

export const WhatsAppSettingsCard: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const pollTimerRef = useRef<any>(null);
  const wasConnectedRef = useRef<boolean>(false);

  const fetchStatus = async (isInitial = false) => {
    try {
      const data = await getWhatsAppStatus();
      setStatus(data);

      if (data.connected && !wasConnectedRef.current && !isInitial) {
        toast.success('WhatsApp successfully connected!');
      }
      wasConnectedRef.current = !!data.connected;
    } catch (err) {
      console.error('Failed to fetch WhatsApp status', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);

    // Dynamic auto-polling every 2.5 seconds to detect live QR scan without manual refresh
    pollTimerRef.current = setInterval(() => {
      fetchStatus(false);
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleReconnect = async () => {
    setActionLoading(true);
    try {
      toast.info('Generating fresh WhatsApp QR code...');
      const res = await reconnectWhatsApp();
      setStatus(res);
      toast.success('Fresh QR code ready. Please scan.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reconnect WhatsApp');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const result = await Swal.fire({
      title: 'Disconnect WhatsApp?',
      text: 'This will unlink the current WhatsApp account. Automated fee receipts will stop until a new device is scanned.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Disconnect',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    setActionLoading(true);
    try {
      await logoutWhatsApp();
      toast.info('WhatsApp disconnected. Generating new QR code...');
      await fetchStatus(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = status?.connected === true;
  const qrCode = status?.qr;

  return (
    <div
      className="ui-card"
      style={{
        marginTop: '24px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: isConnected ? '1px solid #86efac' : '1px solid #fed7aa',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          padding: '16px 20px',
          background: isConnected
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          borderBottom: isConnected ? '1px solid #bbf7d0' : '1px solid #fde68a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 6px rgba(37,211,102,0.35)',
              flexShrink: 0,
            }}
          >
            <MessageSquare size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              WhatsApp Notification Service
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#475569' }}>
              Auto-send official PDF receipts on payment & Student ID cards
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div>
          {loading ? (
            <span style={{ fontSize: '12px', color: '#64748b' }}>Checking status...</span>
          ) : isConnected ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#16a34a',
                color: '#ffffff',
                boxShadow: '0 1px 3px rgba(22,163,74,0.3)',
              }}
            >
              <CheckCircle size={14} /> Connected & Active
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#ea580c',
                color: '#ffffff',
                boxShadow: '0 1px 3px rgba(234,88,12,0.3)',
              }}
            >
              <AlertCircle size={14} /> Scan QR to Link
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div style={{ padding: '20px', background: '#ffffff' }}>
        {isConnected ? (
          /* ================= CONNECTED VIEW ================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#16a34a',
                    flexShrink: 0,
                  }}
                >
                  <Smartphone size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {status?.name ? `${status.name} (${status.phone || 'Linked'})` : status?.phone || 'Linked WhatsApp Device'}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Ready to send automated PDF receipts
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fetchStatus(false)}
                  disabled={actionLoading}
                  className="ui-btn ui-btn-soft ui-btn-sm"
                  title="Refresh WhatsApp Status"
                >
                  <RefreshCw size={14} className={actionLoading ? 'spin' : ''} /> Check
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="ui-btn ui-btn-danger ui-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <LogOut size={14} /> Disconnect / Re-link
                </button>
              </div>
            </div>

            {/* Feature List */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12.5px', color: '#166534' }}>
                <strong>✓ Automated Payment Receipts:</strong>
                <div style={{ fontSize: '11.5px', color: '#15803d', marginTop: '2px' }}>
                  Students & parents receive official branded PDF receipts right after fee collection.
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12.5px', color: '#166534' }}>
                <strong>✓ Student ID Card Dispatch:</strong>
                <div style={{ fontSize: '11.5px', color: '#15803d', marginTop: '2px' }}>
                  Admins can send official vector student ID card PDFs directly to student mobile numbers.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= DISCONNECTED / SCAN QR VIEW ================= */
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            {/* QR Code Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px',
                background: '#ffffff',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                minWidth: '240px',
                minHeight: '260px',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              {qrCode ? (
                <>
                  <div
                    style={{
                      padding: '12px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    <QRCodeSVG value={qrCode} size={210} level="M" />
                  </div>
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '11.5px',
                      color: '#059669',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Zap size={13} /> QR auto-refreshes dynamically
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <RefreshCw size={28} className="spin" color="#2563eb" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Initializing WhatsApp Socket…
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                    Generating QR code to scan. Please wait 5-10 seconds.
                  </div>
                </div>
              )}
            </div>

            {/* Steps & Instructions */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  How to link WhatsApp on this system:
                </h4>
                <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                  <li>Open <strong>WhatsApp</strong> on your official office / hostel phone.</li>
                  <li>Tap <strong>Settings</strong> (iOS) or tap the <strong>Three Dots ⋮</strong> menu (Android).</li>
                  <li>Select <strong>Linked Devices</strong>, then tap <strong>Link a device</strong>.</li>
                  <li>Point your phone camera at the QR code on the left to scan it.</li>
                </ol>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                💡 <strong>One-time Setup:</strong> Once scanned, WhatsApp credentials remain securely linked on this server. Automatic receipt dispatch activates immediately.
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={actionLoading}
                  className="ui-btn ui-btn-primary ui-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={actionLoading ? 'spin' : ''} />
                  {actionLoading ? 'Reconnecting…' : 'Refresh QR Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
