// Shared by the entry points: an element that must exist for the page to work
// at all, so a missing one is a bug to fail on rather than a null to thread
// through everything downstream.
export function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}
