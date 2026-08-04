import React, { useEffect, useState } from 'react';
import { Clock, User, Shield, Activity, ArrowRight, Terminal } from 'lucide-react';

export default function AuditTimeline({ requestId, token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/audit-logs/${requestId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [requestId, token]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading audit logs...</div>;
  }

  if (logs.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No audit trail entries found.</div>;
  }

  const getActorBadge = (role) => {
    switch (role) {
      case 'Admin': return 'Admin';
      case 'Hospital': return 'Hospital';
      case 'NSS Coordinator': return 'NSS';
      case 'Student': return 'Student';
      default: return role;
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#e63946' }}>
        <Terminal size={18} />
        <h4 style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px' }}>
          System Audit Trail & Timeline (REQ-{requestId})
        </h4>
      </div>
      <div className="timeline">
        {logs.map((log) => (
          <div className="timeline-item active" key={log.log_id}>
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="timeline-title" style={{ fontSize: '14px', fontWeight: 600 }}>{log.action}</span>
                <span className="timeline-time" style={{ fontSize: '11px', color: '#64748b' }}>{formatDate(log.timestamp)}</span>
              </div>
              
              {log.new_value && (
                <div className="timeline-desc" style={{ fontSize: '13px', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', marginTop: '6px', fontFamily: 'monospace' }}>
                  {log.old_value ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: '#ef4444' }}>- {log.old_value}</div>
                      <div style={{ color: '#10b981' }}>+ {log.new_value}</div>
                    </div>
                  ) : (
                    <div>{log.new_value}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span className="timeline-actor">
                  <User size={12} style={{ marginRight: '4px' }} />
                  {getActorBadge(log.actor_role)} ID: {log.actor_id}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  IP: {log.ip_address}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
