import React from 'react';
import { Bell, Mail, Phone, Trash2 } from 'lucide-react';

export default function NotificationPanel({ notifications, onClear }) {
  const getIcon = (type) => {
    switch (type) {
      case 'sms':
        return <Phone size={14} style={{ color: '#10b981' }} />;
      case 'email':
        return <Mail size={14} style={{ color: '#06b6d4' }} />;
      default:
        return <Bell size={14} style={{ color: '#e63946' }} />;
    }
  };

  const getChannelLabel = (type) => {
    switch (type) {
      case 'sms': return 'SMS';
      case 'email': return 'Email';
      default: return 'Alert';
    }
  };

  return (
    <div className="notification-side-panel">
      <div className="notification-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} className="logo-icon" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>SIMULATED ALERTS</h3>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Clear notifications"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', padding: '40px 10px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No simulated alerts yet. Complete tasks (e.g. submit requests, verify, approve) to trigger SMS/Email notifications in real-time.
          </div>
        ) : (
          notifications.map((notif) => (
            <div className={`notification-card unread`} key={notif.id}>
              <div className="notification-badge-dot"></div>
              <div className="notification-time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getIcon(notif.type)}
                  {getChannelLabel(notif.type)}
                </span>
              </div>
              <div className="notification-text" style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: '500' }}>
                {notif.message}
              </div>
              {notif.recipient && (
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                  Recipient: {notif.recipient}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
