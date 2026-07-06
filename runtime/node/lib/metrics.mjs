const sanitize = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labelKey = (labels = {}) => Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${sanitize(v)}"`).join(',');

class MetricFamily {
  constructor(name, help, type) {
    this.name = name;
    this.help = help;
    this.type = type;
    this.values = new Map();
  }

  key(labels) { return labelKey(labels); }

  labelsFromKey(key) {
    if (!key) return '';
    return `{${key}}`;
  }
}

class Counter extends MetricFamily {
  constructor(name, help) { super(name, help, 'counter'); }
  inc(labels = {}, value = 1) {
    const key = this.key(labels);
    this.values.set(key, Number(this.values.get(key) || 0) + Number(value || 0));
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [key, value] of this.values) lines.push(`${this.name}${this.labelsFromKey(key)} ${value}`);
    return lines.join('\n');
  }
}

class Gauge extends MetricFamily {
  constructor(name, help) { super(name, help, 'gauge'); }
  set(labels = {}, value = 0) { this.values.set(this.key(labels), Number(value || 0)); }
  inc(labels = {}, value = 1) { this.set(labels, Number(this.values.get(this.key(labels)) || 0) + Number(value || 0)); }
  dec(labels = {}, value = 1) { this.inc(labels, -Number(value || 0)); }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [key, value] of this.values) lines.push(`${this.name}${this.labelsFromKey(key)} ${value}`);
    return lines.join('\n');
  }
}

class Histogram extends MetricFamily {
  constructor(name, help, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    super(name, help, 'histogram');
    this.buckets = buckets;
  }
  observe(labels = {}, seconds = 0) {
    const key = this.key(labels);
    const state = this.values.get(key) || { count: 0, sum: 0, buckets: this.buckets.map(() => 0) };
    state.count += 1;
    state.sum += Number(seconds || 0);
    this.buckets.forEach((bucket, index) => { if (seconds <= bucket) state.buckets[index] += 1; });
    this.values.set(key, state);
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, state] of this.values) {
      const base = key ? `${key},` : '';
      this.buckets.forEach((bucket, index) => lines.push(`${this.name}_bucket{${base}le="${bucket}"} ${state.buckets[index]}`));
      lines.push(`${this.name}_bucket{${base}le="+Inf"} ${state.count}`);
      lines.push(`${this.name}_sum${this.labelsFromKey(key)} ${state.sum}`);
      lines.push(`${this.name}_count${this.labelsFromKey(key)} ${state.count}`);
    }
    return lines.join('\n');
  }
}

export class MetricsRegistry {
  constructor(prefix = 'tunnara') {
    this.prefix = prefix;
    this.metrics = new Map();
  }
  name(name) { return name.startsWith(`${this.prefix}_`) ? name : `${this.prefix}_${name}`; }
  counter(name, help) {
    const finalName = this.name(name);
    if (!this.metrics.has(finalName)) this.metrics.set(finalName, new Counter(finalName, help));
    return this.metrics.get(finalName);
  }
  gauge(name, help) {
    const finalName = this.name(name);
    if (!this.metrics.has(finalName)) this.metrics.set(finalName, new Gauge(finalName, help));
    return this.metrics.get(finalName);
  }
  histogram(name, help, buckets) {
    const finalName = this.name(name);
    if (!this.metrics.has(finalName)) this.metrics.set(finalName, new Histogram(finalName, help, buckets));
    return this.metrics.get(finalName);
  }
  render(extra = {}) {
    const lines = [];
    for (const metric of this.metrics.values()) lines.push(metric.render());
    for (const [name, value] of Object.entries(extra)) {
      const metricName = this.name(name);
      lines.push(`# TYPE ${metricName} gauge`, `${metricName} ${Number(value || 0)}`);
    }
    return `${lines.filter(Boolean).join('\n')}\n`;
  }
}

export const metrics = new MetricsRegistry();
export const httpRequests = metrics.counter('http_requests_total', 'Total de requisições HTTP processadas pelo Edge.');
export const httpRequestDuration = metrics.histogram('http_request_duration_seconds', 'Duração das requisições HTTP processadas pelo Edge.');
export const httpActiveRequests = metrics.gauge('http_active_requests', 'Requisições HTTP ativas no Edge.');
export const policyDecisions = metrics.counter('policy_decisions_total', 'Decisões do mecanismo de políticas.');
export const relayAgents = metrics.gauge('relay_agents_connected', 'Agentes conectados ao Relay.');
export const relayStreams = metrics.gauge('relay_streams_active', 'Streams TCP/WebSocket ativos no Relay.');
export const relayPending = metrics.gauge('relay_proxy_requests_pending', 'Requisições proxy pendentes no Relay.');
export const tunnelTargetHealth = metrics.gauge('tunnel_target_health', 'Estado de saúde do target: 1 saudável, 0 desconhecido, -1 não saudável.');
export const inspectorCaptures = metrics.counter('inspector_captures_total', 'Requisições registradas pelo Request Inspector.');
