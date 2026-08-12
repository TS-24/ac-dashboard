import { AnalyticsOverview } from "./components/analytics-overview";
import { KanbanBoard } from "./components/kanban-board";

export default function Home() {
  return <div className="app-shell" id="top"><main className="dashboard-main"><KanbanBoard /><AnalyticsOverview /></main><footer className="dashboard-footer"><span>Personal Knowledge Stream</span><span>Stay curious.</span></footer></div>;
}
