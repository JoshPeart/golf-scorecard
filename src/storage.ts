import type { Store } from "./types";
const KEY = "golf-scorecard:v1";
export function load(): Store {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && Array.isArray(data.courses) && Array.isArray(data.rounds))
      return data;
  } catch {
    /* Storage may be disabled. */
  }
  return { courses: [], rounds: [] };
}
export function save(data: Store): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
