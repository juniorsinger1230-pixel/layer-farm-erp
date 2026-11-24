export function scheduleForcedExit(delayMs = 5000) {
  const timer = setTimeout(() => process.exit(process.exitCode ?? 0), delayMs);
  return () => clearTimeout(timer);
}
