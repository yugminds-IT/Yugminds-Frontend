"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { adminApi } from "@/lib/api/admin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Activity, AlertCircle, Clock, Download, RefreshCw,
  TrendingUp, Server, CheckCircle, XCircle, BarChart3, LineChart as LineChartIcon
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, Legend
} from "recharts";

const STATUS_COLORS = ['#00C49F', '#FF8042', '#FFBB28', '#0088FE', '#8884D8', '#FF6B6B'];

interface EndpointStat {
  endpoint: string;
  requests: number;
  errors: number;
  avgDuration: number;
  p95Duration: number;
  successRate: number;
}

interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  endpointStats: EndpointStat[];
  uptimeSeconds: number;
}

interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
  userId?: string;
  error?: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<ApiMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsByEndpoint: {},
    errorsByEndpoint: {},
    endpointStats: [],
    uptimeSeconds: 0,
  });
  const [recentMetrics, setRecentMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await adminApi.dashboard.monitoring();
      const m = data?.metrics as ApiMetrics | undefined;
      if (m) {
        setMetrics({
          totalRequests: m.totalRequests ?? 0,
          successfulRequests: m.successfulRequests ?? 0,
          failedRequests: m.failedRequests ?? 0,
          averageResponseTime: m.averageResponseTime ?? 0,
          p95ResponseTime: m.p95ResponseTime ?? 0,
          p99ResponseTime: m.p99ResponseTime ?? 0,
          requestsByEndpoint: m.requestsByEndpoint ?? {},
          errorsByEndpoint: m.errorsByEndpoint ?? {},
          endpointStats: m.endpointStats ?? [],
          uptimeSeconds: m.uptimeSeconds ?? 0,
        });
      }
      const recent = data?.recent as PerformanceMetric[] | undefined;
      if (Array.isArray(recent)) setRecentMetrics(recent);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadMetrics, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadMetrics]);

  const exportMetrics = () => {
    const blob = new Blob([JSON.stringify({ metrics, recentMetrics, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const errorRate = metrics.totalRequests > 0
    ? (metrics.failedRequests / metrics.totalRequests * 100).toFixed(2) : '0.00';
  const successRate = metrics.totalRequests > 0
    ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) : '100.00';

  // Last 30 recent requests for the time-series chart.
  // toLocaleTimeString() only has second-level resolution, so several
  // requests landing within the same second get identical-looking X-axis
  // labels even though their underlying (millisecond) timestamps differ —
  // append the millisecond remainder to keep labels genuinely distinct.
  const timeSeriesData = recentMetrics.slice(-30).map((m) => ({
    time: `${new Date(m.timestamp).toLocaleTimeString()}.${String(m.timestamp % 1000).padStart(3, '0')}`,
    duration: m.duration,
    endpoint: m.endpoint.split('/').pop() || m.endpoint,
  }));

  // Status code distribution from recent
  const statusCodeMap: Record<string, number> = {};
  for (const m of recentMetrics) {
    const key = `${Math.floor(m.statusCode / 100) * 100}xx`;
    statusCodeMap[key] = (statusCodeMap[key] ?? 0) + 1;
  }
  const statusCodeChartData = Object.entries(statusCodeMap).map(([name, value]) => ({ name, value }));

  // Top 10 endpoints for bar chart
  const topEndpoints = (metrics.endpointStats ?? []).slice(0, 10);

  const healthStatus = parseFloat(successRate) >= 95 ? 'Healthy' : parseFloat(successRate) >= 85 ? 'Degraded' : 'Unhealthy';
  const healthColor = healthStatus === 'Healthy' ? 'text-green-600' : healthStatus === 'Degraded' ? 'text-yellow-600' : 'text-red-600';
  const perfLabel = metrics.averageResponseTime < 200 ? 'Excellent' : metrics.averageResponseTime < 500 ? 'Good' : metrics.averageResponseTime < 1000 ? 'Fair' : 'Poor';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time API performance and system health metrics</p>
          <p className="text-xs text-gray-400 mt-1">
            In-memory metrics — collected since the backend process last started; they reset on every server restart/deploy.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh(!autoRefresh)}>
            <Activity className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" onClick={loadMetrics} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={exportMetrics}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : metrics.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">All API requests tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? '...' : `${successRate}%`}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.successfulRequests.toLocaleString()} successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{isLoading ? '...' : `${errorRate}%`}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.failedRequests.toLocaleString()} failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : `${metrics.averageResponseTime}ms`}</div>
            <p className="text-xs text-muted-foreground mt-1">Average across all endpoints</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Last 30 API response times</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-[300px]"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : timeSeriesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis unit="ms" />
                      <Tooltip formatter={(v: number) => [`${v}ms`, 'Response Time']} />
                      <Line type="monotone" dataKey="duration" stroke="#0088FE" strokeWidth={2} dot={{ r: 3 }} name="Response Time (ms)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <div className="text-center"><LineChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" /><p>No data yet — make some API requests</p></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Code Distribution</CardTitle>
                <CardDescription>HTTP status codes from recent requests</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-[300px]"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : statusCodeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie data={statusCodeChartData} cx="50%" cy="50%" labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={90} dataKey="value">
                        {statusCodeChartData.map((_, i) => (
                          <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <div className="text-center"><BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" /><p>No status code data yet</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader><CardTitle>System Health</CardTitle><CardDescription>Overall system status</CardDescription></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-3xl font-bold ${healthColor}`}>{healthStatus}</div>
                    <p className="text-sm text-gray-600 mt-2">
                      {healthStatus === 'Healthy' ? 'All systems operational' : healthStatus === 'Degraded' ? 'Some issues detected' : 'Critical issues detected'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Uptime: {formatUptime(metrics.uptimeSeconds)}</p>
                  </div>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${healthStatus === 'Healthy' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {healthStatus === 'Healthy' ? <CheckCircle className="h-8 w-8 text-green-600" /> : <AlertCircle className="h-8 w-8 text-yellow-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Performance Score</CardTitle><CardDescription>Based on response times</CardDescription></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{perfLabel}</div>
                <p className="text-sm text-gray-600 mt-2">Avg: {metrics.averageResponseTime}ms</p>
                <p className="text-xs text-gray-400 mt-1">P95: {metrics.p95ResponseTime}ms · P99: {metrics.p99ResponseTime}ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Request Volume</CardTitle><CardDescription>Total tracked requests</CardDescription></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{metrics.totalRequests.toLocaleString()}</div>
                <p className="text-sm text-gray-600 mt-2">{metrics.successfulRequests} success · {metrics.failedRequests} failed</p>
                <p className="text-xs text-gray-400 mt-1">Since server start</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Endpoints ── */}
        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints by Request Volume</CardTitle>
              <CardDescription>Most frequently accessed API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : topEndpoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, topEndpoints.length * 45)}>
                  <BarChart data={topEndpoints} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="endpoint" type="category" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="requests" fill="#0088FE" name="Requests" />
                    <Bar dataKey="errors" fill="#FF8042" name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <div className="text-center"><BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" /><p>No endpoint data yet</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Endpoint Details</CardTitle><CardDescription>Per-endpoint metrics with avg and P95 response times</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Endpoint</th>
                      <th className="p-2 text-right">Requests</th>
                      <th className="p-2 text-right">Errors</th>
                      <th className="p-2 text-right">Avg</th>
                      <th className="p-2 text-right">P95</th>
                      <th className="p-2 text-right">Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topEndpoints.length > 0 ? topEndpoints.map((ep, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-mono text-xs max-w-[260px] truncate">{ep.endpoint}</td>
                        <td className="p-2 text-right">{ep.requests.toLocaleString()}</td>
                        <td className="p-2 text-right">
                          <Badge variant={ep.errors > 0 ? "destructive" : "default"}>{ep.errors}</Badge>
                        </td>
                        <td className="p-2 text-right">{ep.avgDuration}ms</td>
                        <td className="p-2 text-right">{ep.p95Duration}ms</td>
                        <td className="p-2 text-right">
                          <Badge variant={ep.successRate >= 95 ? "default" : "secondary"}>{ep.successRate}%</Badge>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="text-center p-8 text-gray-500">No endpoint data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance ── */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Response Time Area Chart</CardTitle><CardDescription>Last 30 requests — response time over time</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis unit="ms" />
                    <Tooltip formatter={(v: number) => [`${v}ms`, 'Response Time']} />
                    <Area type="monotone" dataKey="duration" stroke="#0088FE" fill="#0088FE" fillOpacity={0.2} name="Response Time (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  <div className="text-center"><TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-400" /><p>No performance data yet</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Response Time Buckets</CardTitle><CardDescription>Distribution of recent response times</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Fast (< 200ms)', filter: (d: number) => d < 200, color: 'bg-green-100 text-green-800' },
                    { label: 'Normal (200–500ms)', filter: (d: number) => d >= 200 && d < 500, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Slow (500–1000ms)', filter: (d: number) => d >= 500 && d < 1000, color: 'bg-yellow-100 text-yellow-800' },
                    { label: 'Very Slow (> 1000ms)', filter: (d: number) => d >= 1000, color: 'bg-red-100 text-red-800' },
                  ].map(({ label, filter, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge className={color}>{recentMetrics.filter((m) => filter(m.duration)).length}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Latency Percentiles</CardTitle><CardDescription>Key performance indicators</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Average', value: `${metrics.averageResponseTime}ms` },
                    { label: 'P95 Latency', value: `${metrics.p95ResponseTime}ms` },
                    { label: 'P99 Latency', value: `${metrics.p99ResponseTime}ms` },
                    { label: 'Min (recent)', value: recentMetrics.length > 0 ? `${Math.min(...recentMetrics.map((m) => m.duration))}ms` : '—' },
                    { label: 'Max (recent)', value: recentMetrics.length > 0 ? `${Math.max(...recentMetrics.map((m) => m.duration))}ms` : '—' },
                    { label: 'Total Requests', value: metrics.totalRequests.toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-sm font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Recent Activity ── */}
        <TabsContent value="recent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Activity</CardTitle>
              <CardDescription>Last {recentMetrics.length} requests (newest first)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Time</th>
                      <th className="p-2">Method</th>
                      <th className="p-2">Endpoint</th>
                      <th className="p-2 text-right">Duration</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMetrics.length > 0 ? (
                      [...recentMetrics].reverse().map((m, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500 whitespace-nowrap">{new Date(m.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2"><Badge variant="outline">{m.method}</Badge></td>
                          <td className="p-2 font-mono text-xs max-w-[300px] truncate">{m.endpoint}</td>
                          <td className="p-2 text-right">
                            <span className={m.duration >= 1000 ? 'text-red-600 font-semibold' : m.duration >= 500 ? 'text-yellow-600' : 'text-green-600'}>
                              {m.duration}ms
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={m.statusCode >= 500 ? "destructive" : m.statusCode >= 400 ? "secondary" : "default"}>
                              {m.statusCode}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="text-center p-8 text-gray-500">No recent activity yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
