export function elapsedMs(startedAt: number | null, now = Date.now()): number {
  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}
