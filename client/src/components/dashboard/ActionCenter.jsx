import React from 'react'

export default function ActionCenter({ items = [], onAction }) {
  return (
    <section className="kai-v74-action-center">
      <h2>What needs attention now</h2>
      <div className="kai-v74-action-grid">
        {items.map((item) => (
          <button key={item.key} className="kai-v74-action-chip" onClick={() => onAction?.(item.key)}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </div>
            {item.count > 0 && <span className="kai-v74-action-chip__count">{item.count}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
