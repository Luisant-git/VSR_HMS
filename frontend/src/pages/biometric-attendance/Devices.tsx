import { useEffect, useState } from 'react';
import { AlertTriangle, CloudUpload, Database, RefreshCw, Router, Wifi, WifiOff } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioEmpty,
  BioErrorNotice,
  BioExportButton,
  BioPageHead,
  BioRefresh,
  BioSourceNotice,
  BioStatGrid,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDateTime, number } from './utils';

const Devices = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, loading, error, reload } = useApiData(() => BiometricAttendanceAPI.devices(), []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(reload, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, reload]);

  const devices = data?.data || [];
  const summary = data?.summary;

  const handleExport = () => {
    if (!devices.length) return;
    exportExcel(
      [
        {
          name: 'Devices',
          rows: devices.map((device) => ({
            Device: device.device_name,
            'Device ID': device.device_id,
            'IP address': device.ip_address || '',
            Status: device.is_online ? 'Online' : 'Offline',
            'Serial number': device.serial_number || '',
            Firmware: device.firmware_version || '',
            Platform: device.platform || '',
            'Punches in RAM': device.punches_in_ram,
            'Last online': device.last_online_at || '',
            'Last synced timestamp': device.last_synced_timestamp || '',
            'Total synced records': device.total_synced_records,
            'Last sync status': device.last_sync_status || '',
            'Last successful sync': device.last_successful_sync || '',
            'Last error': device.last_error_message || '',
          })),
        },
      ],
      `biometric-devices-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Device & sync status"
        subtitle="Terminal connectivity, firmware and record sync health"
        actions={
          <>
            <label className="bio-check">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto-refresh 30s
            </label>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!devices.length} />
          </>
        }
      />

      <BioSourceNotice available={data?.available} message={data?.message} loading={loading && !data} />
      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Registered devices', value: summary?.total ?? '—', sub: 'In device registry', icon: <Router size={19} />, tone: 'accent' },
            { label: 'Online', value: summary?.online ?? '—', sub: 'Reporting normally', icon: <Wifi size={19} />, tone: 'success' },
            { label: 'Offline', value: summary?.offline ?? '—', sub: 'Needs attention', icon: <WifiOff size={19} />, tone: 'danger' },
            { label: 'Records synced', value: number(summary?.totalRecords).toLocaleString('en-IN'), sub: 'Across all terminals', icon: <Database size={19} />, tone: 'info' },
            { label: 'Sync errors', value: summary?.syncErrors ?? '—', sub: summary?.lastSuccessfulSync || 'No successful sync recorded', icon: <AlertTriangle size={19} />, tone: 'warning' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Terminal fleet"
          subtitle="Live state of every biometric device connected to the hostel"
          icon={<Router size={17} />}
          action={<span className="bio-live-pill"><span className="bio-live-dot" /> Polling every 30s</span>}
        />

        <div className="bio-card-body">
          {devices.length === 0 ? (
            <BioEmpty
              title={loading ? 'Loading devices...' : 'No biometric devices found'}
              text="Register a device in the biometric registry or run a sync to see its connectivity and sync history here."
              icon={<Router size={30} />}
            />
          ) : (
            <div className="bio-device-grid">
              {devices.map((device) => (
                <div className="bio-device-card" key={device.device_id}>
                  <div className="bio-device-head">
                    <div>
                      <div className="bio-device-name">{device.device_name || device.device_id}</div>
                      <div className="bio-device-ip">{device.ip_address || device.device_id}</div>
                    </div>
                    <span className={`bio-status ${device.is_online ? 'is-success' : 'is-danger'}`}>
                      {device.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="bio-device-grid-inner">
                    <div>
                      <span>Serial number</span>
                      <strong>{device.serial_number || '—'}</strong>
                    </div>
                    <div>
                      <span>Firmware</span>
                      <strong>{device.firmware_version || '—'}</strong>
                    </div>
                    <div>
                      <span>Face version</span>
                      <strong>{device.face_version || '—'}</strong>
                    </div>
                    <div>
                      <span>Platform</span>
                      <strong>{device.platform || '—'}</strong>
                    </div>
                    <div>
                      <span>Punches in RAM</span>
                      <strong>{number(device.punches_in_ram).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span>Total synced</span>
                      <strong>{number(device.total_synced_records).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span>Last online</span>
                      <strong>{device.last_online_at ? formatDateTime(device.last_online_at) : '—'}</strong>
                    </div>
                    <div>
                      <span>Last sync status</span>
                      <strong>{device.last_sync_status || '—'}</strong>
                    </div>
                    <div>
                      <span>Last synced record</span>
                      <strong>{device.last_synced_timestamp || '—'}</strong>
                    </div>
                    <div>
                      <span>Last successful sync</span>
                      <strong>{device.last_successful_sync ? formatDateTime(device.last_successful_sync) : '—'}</strong>
                    </div>
                  </div>

                  {device.last_error_message ? (
                    <div className="bio-device-error">
                      <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                      {device.last_error_message}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bio-card">
        <BioCardHead
          title="Sync health"
          subtitle="How many records are moving from devices into the attendance store"
          icon={<CloudUpload size={17} />}
          action={
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={reload} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'bio-spin' : ''} /> Refresh sync state
            </button>
          }
        />
        <div className="bio-card-body">
          <div className="bio-device-grid-inner" style={{ borderTop: 0, paddingTop: 0 }}>
            <div>
              <span>Total records</span>
              <strong>{number(summary?.totalRecords).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span>Devices online</span>
              <strong>{summary?.online ?? 0} / {summary?.total ?? 0}</strong>
            </div>
            <div>
              <span>Sync errors</span>
              <strong>{summary?.syncErrors ?? 0}</strong>
            </div>
            <div>
              <span>Last successful sync</span>
              <strong>{summary?.lastSuccessfulSync || '—'}</strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Devices;
