import React from 'react'

export default function DashboardSummary({
  stats = { apartments: 0, capacity: 0, open: 0, resolved: 0, onAirbnb: 0 }
}) {
  return (
    <section className="kai-v74-dashboard-summary">
      <div className="kai-v74-stat">
        <span>🏠</span>
        <strong>{stats.apartments}</strong>
        <label>Apartments</label>
      </div>
      <div className="kai-v74-stat">
        <span>👥</span>
        <strong>{stats.capacity}</strong>
        <label>Total capacity</label>
      </div>
      <div className="kai-v74-stat">
        <span>⚠️</span>
        <strong>{stats.open}</strong>
        <label>Open reports</label>
      </div>
      <div className="kai-v74-stat">
        <span>✅</span>
        <strong>{stats.resolved}</strong>
        <label>Resolved</label>
      </div>
      <div className="kai-v74-stat">
        <span>🔗</span>
        <strong>{stats.onAirbnb}</strong>
        <label>On Airbnb</label>
      </div>
    </section>
  )
}
