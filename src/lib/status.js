// Where a problem is: not started, being worked on, or solved.
// `solved` stays in the data and always equals (status === "solved").
export const STATUSES = ["todo", "in-progress", "solved"];

export const isStatus = (value) => STATUSES.includes(value);

// Status of a saved entry; entries saved before statuses existed have none.
export const getStatus = (entry) =>
  isStatus(entry?.status) ? entry.status : entry?.solved ? "solved" : "todo";
