const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

interface RequestKey { method: string; route: string; status: number }

function labels(values: Record<string, string | number>): string {
  return `{${Object.entries(values).map(([key, value]) => `${key}="${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`).join(',')}}`;
}

export class ServiceMetrics {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, { count: number; sum: number; buckets: number[] }>();

  observeRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const key: RequestKey = { method, route, status };
    const requestKey = JSON.stringify(key);
    this.requests.set(requestKey, (this.requests.get(requestKey) ?? 0) + 1);
    const durationKey = JSON.stringify({ method, route });
    const duration = this.durations.get(durationKey) ?? { count: 0, sum: 0, buckets: DURATION_BUCKETS.map(() => 0) };
    duration.count += 1;
    duration.sum += durationSeconds;
    DURATION_BUCKETS.forEach((bucket, index) => { if (durationSeconds <= bucket) duration.buckets[index] = (duration.buckets[index] ?? 0) + 1; });
    this.durations.set(durationKey, duration);
  }

  render(service: string): string {
    const lines = [
      '# HELP layer_farm_http_requests_total Total HTTP requests.',
      '# TYPE layer_farm_http_requests_total counter',
    ];
    for (const [rawKey, count] of this.requests) {
      const key = JSON.parse(rawKey) as RequestKey;
      lines.push(`layer_farm_http_requests_total${labels({ method: key.method, route: key.route, status: key.status })} ${count}`);
    }
    lines.push('# HELP layer_farm_http_request_duration_seconds HTTP request duration.', '# TYPE layer_farm_http_request_duration_seconds histogram');
    for (const [rawKey, duration] of this.durations) {
      const key = JSON.parse(rawKey) as { method: string; route: string };
      DURATION_BUCKETS.forEach((bucket, index) => lines.push(`layer_farm_http_request_duration_seconds_bucket${labels({ method: key.method, route: key.route, le: bucket })} ${duration.buckets[index] ?? 0}`));
      lines.push(`layer_farm_http_request_duration_seconds_bucket${labels({ method: key.method, route: key.route, le: '+Inf' })} ${duration.count}`);
      lines.push(`layer_farm_http_request_duration_seconds_sum${labels(key)} ${duration.sum}`, `layer_farm_http_request_duration_seconds_count${labels(key)} ${duration.count}`);
    }
    const memory = process.memoryUsage();
    lines.push('# TYPE process_uptime_seconds gauge', `process_uptime_seconds${labels({ service })} ${process.uptime()}`);
    lines.push('# TYPE process_resident_memory_bytes gauge', `process_resident_memory_bytes${labels({ service })} ${memory.rss}`);
    lines.push('# TYPE process_heap_used_bytes gauge', `process_heap_used_bytes${labels({ service })} ${memory.heapUsed}`);
    return `${lines.join('\n')}\n`;
  }
}
