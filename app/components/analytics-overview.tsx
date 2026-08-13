import { activity, activityLabels, analytics } from "../dashboard-data";

export function AnalyticsOverview() {
  return (
    <section className="analytics-section" id="analytics" aria-labelledby="analytics-title">
      <div className="section-title-row">
        <div><p className="eyebrow">A quiet overview</p><h2 id="analytics-title">Your week, in view</h2></div>
        <span className="section-note">Last 7 days <i>⌄</i></span>
      </div>
      <div className="analytics-grid">
        <div className="metric-grid">
          {analytics.map((metric, index) => <article className="metric-card" key={metric.label}><span className="metric-number">0{index + 1}</span><p>{metric.label}</p><div className="metric-value-row"><strong>{metric.value}</strong><span className={metric.tone === "orange" ? "change-warn" : "change-up"}>{metric.change}</span></div><small>{metric.detail}</small></article>)}
        </div>
        <article className="activity-card"><div className="activity-heading"><div><p className="eyebrow">Momentum</p><h3>Weekly activity</h3></div><span className="activity-total">+18%</span></div><div className="chart" aria-label="Weekly task activity trend"><div className="chart-gridlines"><i /><i /><i /></div><div className="chart-bars">{activity.map((height, index) => <div className="bar-wrap" key={activityLabels[index]}><div className="chart-bar" style={{ height: `${height}%` }} /><span>{activityLabels[index].slice(0, 1)}</span></div>)}</div></div></article>
      </div>
    </section>
  );
}
