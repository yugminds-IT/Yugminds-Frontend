"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api/admin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Users,
  School,
  BarChart3,
  Activity,
  Download,
  RefreshCw
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from "recharts";

/** Renders the "+X% from last month" line, or "New this month" when there's
 * no prior-month baseline to compare against (0 -> N is not a meaningful %). */
function TrendLabel({ change }: { change: number | null }) {
  if (change === null) {
    return <p className="text-xs text-blue-600">New this month</p>;
  }
  return (
    <p className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {change >= 0 ? '+' : ''}{change}% from last month
    </p>
  );
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState({
    totalSchools: 0,
    totalTeachers: 0,
    totalStudents: 0,
    activeCourses: 0,
    systemHealth: 100, // Will be calculated from real metrics
    avgAttendance: 0,
    completionRate: 0
  });
  const [trends, setTrends] = useState<{
    schoolsChange: number | null;
    teachersChange: number | null;
    studentsChange: number | null;
    coursesChange: number | null;
  }>({
    schoolsChange: 0,
    teachersChange: 0,
    studentsChange: 0,
    coursesChange: 0
  });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [monthlyGrowth, setMonthlyGrowth] = useState<Array<{name: string; schools: number; teachers: number; students: number; courses: number}>>([]);
  const [topSchools, setTopSchools] = useState<Array<{name: string; engagement: number}>>([]);
  const [popularCourses, setPopularCourses] = useState<Array<{name: string; students: number}>>([]);
  const [schoolDistribution, setSchoolDistribution] = useState<Array<{name: string; value: number; color: string; percentage?: number}>>([]);
  const [teacherPerformance, setTeacherPerformance] = useState<Array<{name: string; value: number; color: string}>>([]);
  const [courseEngagement, setCourseEngagement] = useState<Array<{name: string; engagement: number; completion: number}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const { data: result } = await adminApi.dashboard.analytics(force ? { force: true } : undefined);

      if (result?.analytics) {
        setAnalytics(result.analytics);
      }
      setGeneratedAt(result?.generatedAt ?? null);

      if (result?.trends) {
        setTrends(result.trends);
      }
      if (result?.monthlyGrowth) {
        setMonthlyGrowth(result.monthlyGrowth);
      }
      if (result?.topSchools) {
        setTopSchools(result.topSchools);
      }
      if (result?.popularCourses) {
        setPopularCourses(result.popularCourses);
      }
      if (result?.schoolDistribution) {
        setSchoolDistribution(result.schoolDistribution);
      }
      if (result?.teacherPerformance) {
        const perf = result.teacherPerformance as { excellent?: number; good?: number; average?: number; needsImprovement?: number };
        setTeacherPerformance([
          { name: 'Excellent', value: perf.excellent ?? 0, color: '#00C49F' },
          { name: 'Good', value: perf.good ?? 0, color: '#0088FE' },
          { name: 'Average', value: perf.average ?? 0, color: '#FFBB28' },
          { name: 'Needs Improvement', value: perf.needsImprovement ?? 0, color: '#FF8042' }
        ]);
      }
      if (result?.courseEngagement) {
        setCourseEngagement(result.courseEngagement);
      } else {
        setCourseEngagement([]);
      }

      console.log('✅ Analytics loaded successfully (real-time):', result);
      setLoadError(null);
    } catch (error) {
      console.error('Error loading analytics:', error);
      const err = error as { response?: { data?: { error?: string; details?: string; message?: string } } };
      const msg = err.response?.data?.error ?? err.response?.data?.details ?? err.response?.data?.message ?? (error instanceof Error ? error.message : 'Unknown error');
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadAnalytics,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });


  const exportAnalytics = async (type: string) => {
    try {
      const payload = {
        analytics,
        trends,
        monthlyGrowth,
        topSchools,
        popularCourses,
        schoolDistribution,
        teacherPerformance,
        courseEngagement,
        exported_at: new Date().toISOString(),
        type,
      };

      const filenameBase = `performance_analytics_${new Date().toISOString().slice(0, 10)}`;

      if (type === 'json' || type === 'full') {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenameBase}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // CSV export (key metrics + top lists)
      const rows: string[][] = [];
      rows.push(['metric', 'value']);
      rows.push(['totalSchools', String(analytics.totalSchools)]);
      rows.push(['totalTeachers', String(analytics.totalTeachers)]);
      rows.push(['totalStudents', String(analytics.totalStudents)]);
      rows.push(['activeCourses', String(analytics.activeCourses)]);
      rows.push(['systemHealth', String(analytics.systemHealth)]);
      rows.push(['avgAttendance', String(analytics.avgAttendance)]);
      rows.push(['completionRate', String(analytics.completionRate)]);
      rows.push(['schoolsChange', String(trends.schoolsChange)]);
      rows.push(['teachersChange', String(trends.teachersChange)]);
      rows.push(['studentsChange', String(trends.studentsChange)]);
      rows.push(['coursesChange', String(trends.coursesChange)]);

      rows.push([]);
      rows.push(['topSchools.name', 'engagement']);
      topSchools.forEach((s) => rows.push([s.name, String(s.engagement)]));

      rows.push([]);
      rows.push(['popularCourses.name', 'students']);
      popularCourses.forEach((c) => rows.push([c.name, String(c.students)]));

      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  return (
    <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Performance Analytics</h1>
                <p className="text-gray-600 mt-2">Comprehensive system analytics and insights</p>
                {generatedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {new Date(generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => (window.location.href = '/lms/admin/assignment-analytics')}>
                  Assignment Analytics
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadAnalytics(true)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Loading...' : 'Refresh'}
                </Button>
                <Button variant="outline" onClick={() => exportAnalytics('json')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button variant="outline" onClick={() => exportAnalytics('csv')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {loadError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              Failed to load analytics: {loadError}. Please try refreshing.
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '...' : analytics.totalSchools}</div>
                <TrendLabel change={trends.schoolsChange} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '...' : analytics.totalTeachers}</div>
                <TrendLabel change={trends.teachersChange} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '...' : analytics.totalStudents}</div>
                <TrendLabel change={trends.studentsChange} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Request Success Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{analytics.systemHealth}%</div>
                <p className="text-xs text-muted-foreground" title="Share of recent API requests that completed without a server error — not a real uptime/availability measurement, and resets whenever the server restarts.">
                  Recent API success rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Analytics */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="growth">Growth</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Growth */}
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Growth</CardTitle>
                    <CardDescription>User and content growth over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center h-[300px]">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : monthlyGrowth.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlyGrowth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="schools" stackId="1" stroke="#8884d8" fill="#8884d8" name="Schools" />
                          <Area type="monotone" dataKey="teachers" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Teachers" />
                          <Area type="monotone" dataKey="students" stackId="1" stroke="#ffc658" fill="#ffc658" name="Students" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No growth data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* School Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>School Distribution</CardTitle>
                    <CardDescription>Types of schools in the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center h-[300px]">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : schoolDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={schoolDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props: { name?: string; percentage?: number }) => {
                              const name = props.name || '';
                              const percentage = props.percentage || 0;
                              return `${name}: ${percentage}%`;
                            }}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {schoolDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string, props: { payload?: { percentage?: number } }) => [
                            `${value} schools (${props.payload?.percentage || 0}%)`,
                            name
                          ]} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        <div className="text-center">
                          <School className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No school distribution data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Performance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Average Attendance</CardTitle>
                    <CardDescription>Teacher attendance rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{analytics.avgAttendance}%</div>
                    <p className="text-sm text-gray-600 mt-2">This month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Course Completion</CardTitle>
                    <CardDescription>Average course completion rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{analytics.completionRate}%</div>
                    <p className="text-sm text-gray-600 mt-2">Overall</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Active Courses</CardTitle>
                    <CardDescription>Published courses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">{analytics.activeCourses}</div>
                    <p className="text-sm text-gray-600 mt-2">Live courses</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Growth Tab */}
            <TabsContent value="growth" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Growth Trends</CardTitle>
                  <CardDescription>Detailed growth analysis over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-[400px]">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : monthlyGrowth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monthlyGrowth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="schools" fill="#8884d8" name="Schools" />
                        <Bar dataKey="teachers" fill="#82ca9d" name="Teachers" />
                        <Bar dataKey="students" fill="#ffc658" name="Students" />
                        <Bar dataKey="courses" fill="#ff8042" name="Courses" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No growth data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Teacher Performance</CardTitle>
                    <CardDescription>Distribution of teacher performance levels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center h-[300px]">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : teacherPerformance.length > 0 && teacherPerformance.some(p => p.value > 0) ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={teacherPerformance.filter(p => p.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props: { name?: string; value?: number }) => {
                              const name = props.name || '';
                              const value = props.value || 0;
                              return `${name}: ${value}`;
                            }}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {teacherPerformance.filter(p => p.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value} teachers`} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        <div className="text-center">
                          <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No teacher performance data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Key performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Request Success Rate</span>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          {analytics.systemHealth}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Teacher Attendance</span>
                        <Badge variant="default" className="bg-blue-100 text-blue-800">
                          {analytics.avgAttendance}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Course Completion</span>
                        <Badge variant="default" className="bg-purple-100 text-purple-800">
                          {analytics.completionRate}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Active Users</span>
                        <Badge variant="default" className="bg-orange-100 text-orange-800">
                          {analytics.totalTeachers + analytics.totalStudents}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Engagement Tab */}
            <TabsContent value="engagement" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Engagement</CardTitle>
                  <CardDescription>Student engagement and course completion trends</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-[400px]">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : courseEngagement.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={courseEngagement}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="engagement" stroke="#8884d8" strokeWidth={2} name="Engagement %" />
                        <Line type="monotone" dataKey="completion" stroke="#82ca9d" strokeWidth={2} name="Completion %" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No engagement data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Schools</CardTitle>
                    <CardDescription>Schools with highest engagement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topSchools.length > 0 ? (
                        topSchools.map((school, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{school.name}</span>
                            <Badge variant="default">{school.engagement}%</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Most Popular Courses</CardTitle>
                    <CardDescription>Courses with highest enrollment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {popularCourses.length > 0 ? (
                        popularCourses.map((course, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{course.name}</span>
                            <Badge variant="default">{course.students} students</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
    </div>
  );
}
