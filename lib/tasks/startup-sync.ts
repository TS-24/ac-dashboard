import { syncAssignments } from "./sync-assignments.ts";

const summary = await syncAssignments();
console.log(`Assignment sync: ${JSON.stringify(summary)}`);
