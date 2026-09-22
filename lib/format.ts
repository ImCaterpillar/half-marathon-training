export function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatDistanceKm(value: unknown) {
  const number = toNumber(value, 0);
  return `${round1(number)} km`;
}

export function formatDuration(seconds: unknown) {
  const totalSeconds = Math.max(0, Math.round(toNumber(seconds, 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(secondsPerKm: unknown) {
  const seconds = nullableNumber(secondsPerKm);
  if (seconds === null || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}'${String(secs).padStart(2, "0")}"/km`;
}

export function computePaceSeconds(durationSeconds: number | null | undefined, distanceKm: number | null | undefined) {
  if (!durationSeconds || !distanceKm || distanceKm <= 0) return null;
  return Math.round(durationSeconds / distanceKm);
}

export function computePaceText(durationSeconds: number | null | undefined, distanceKm: number | null | undefined) {
  const pace = computePaceSeconds(durationSeconds, distanceKm);
  return pace ? formatPace(pace) : null;
}

export function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function secondsToGoalGapText(currentSeconds: number | null | undefined, goalSeconds: number | null | undefined) {
  if (!currentSeconds || !goalSeconds) return "暂无测试数据";
  const diff = currentSeconds - goalSeconds;
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  return diff > 0 ? `慢 ${minutes}分${seconds}秒` : `快 ${minutes}分${seconds}秒`;
}
