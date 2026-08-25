// Shared physical lifecycle limits for expedition-family parties. Keeping these in a leaf module
// lets selectors evaluate the same duration authority without importing the expedition executor.
export const EXPEDITION_MAX_DURATION_DAYS = 24;
export const EXPEDITION_MAX_WORK_DAYS = 3;
