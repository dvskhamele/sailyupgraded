export const DEFAULT_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;

export function calculatePercentage(usedStorage: number, totalStorage: number) {
  if (!Number.isFinite(usedStorage) || !Number.isFinite(totalStorage) || totalStorage <= 0) {
    return 0;
  }

  return Math.min(Math.round((usedStorage / totalStorage) * 100), 100);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
