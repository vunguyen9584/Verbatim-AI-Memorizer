// Centralized environment flags (Vite)
// Usage: define VITE_SHOW_DEBUG_BUTTON in .env/.env.local as true/false

const toBool = (val: unknown, defaultValue = false): boolean => {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'boolean') return val;
  const v = String(val).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

export const env = {
  showDebugButton: toBool(import.meta.env.VITE_SHOW_DEBUG_BUTTON, false),
};
