export type Card = {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  priority: "high" | "medium" | "low";
  due: string;
  tag: string;
  owner: string;
  avatar: string;
  avatarColor: string;
  position?: number;
  sourceUrl: string | null;
  enrichmentStatus: string;
  itemCount: number;
};

export type BoardColumn = {
  title: string;
  count: number;
  color: string;
  cards: Card[];
};

export const activity = [42, 58, 49, 73, 61, 86, 70];
export const activityLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const analytics = [
  { label: "Total tasks", value: "48", change: "+12.5%", detail: "vs. last week", tone: "blue", icon: "◫" },
  { label: "Completion rate", value: "68%", change: "+8.2%", detail: "vs. last week", tone: "green", icon: "✓" },
  { label: "Active sources", value: "06", change: "+2", detail: "this month", tone: "violet", icon: "⌁" },
  { label: "Needs attention", value: "07", change: "3 overdue", detail: "needs review", tone: "orange", icon: "!" },
] as const;

export const boardColumns: BoardColumn[] = [
  {
    title: "Backlog",
    count: 0,
    color: "slate",
    cards: [],
  },
  {
    title: "In progress",
    count: 0,
    color: "blue",
    cards: [],
  },
  {
    title: "Review",
    count: 0,
    color: "amber",
    cards: [],
  },
  {
    title: "Done",
    count: 0,
    color: "green",
    cards: [],
  },
];
