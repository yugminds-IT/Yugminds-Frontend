"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTeacherSchool } from "../context";
import { WEEKDAY_NAMES } from "@/lib/weekday-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  useTeacherClasses, 
  useTeacherReports, 
  useSubmitReport,
  useTeacherPeriods,
  useTeacherSchedules
} from "@/hooks/useTeacherData";
import { FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import { toast } from "@/components/ui/toast";

type ScheduleRow = { day_of_week?: string; period_id?: string; start_time?: string; end_time?: string; grade?: string; subject?: string };
type PeriodRow = { id: string; period_number?: number; grade?: string; subject?: string; start_time?: string; end_time?: string; class_name?: string };
type ReportRow = { id?: string; grade?: string; date?: string; report_status?: string; topics_taught?: string; classes?: Array<{ grade?: string }>; period_id?: string };

/**
 * Submit Daily Teaching Report Page
 * 
 * Allows teachers to submit daily teaching reports.
 * When a report is submitted, attendance is automatically marked as Present
 * (unless there's an existing Leave-Approved status).
 */
export default function SubmitReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { selectedSchool } = useTeacherSchool();
  
  const initialFormData = {
    period_id: '',
    grade: '', // Use grade instead of class_id
    date: new Date().toLocaleDateString('en-CA'), // Local YYYY-MM-DD
    start_time: '',
    end_time: '',
    topics_taught: '',
    activities: '',
    notes: '',
    student_count: ''
  };
  
  // Load saved form data if available
  const savedFormData = typeof window !== 'undefined' 
    ? loadFormData<typeof initialFormData>('teacher-report-form') 
    : null;
  
  const [formData, setFormData] = useState(savedFormData || initialFormData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Enhanced auto-save with useAutoSaveForm hook
  const { isDirty: isFormDirty, clearSavedData } = useAutoSaveForm({
    formId: 'teacher-report-form',
    formData,
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (data && (!savedFormData || Object.keys(savedFormData).length === 0)) {
        setFormData(data);
      }
    },
    markDirty: true,
  });
  
  // Check if form has unsaved data
  const hasUnsavedData = () => {
    return isFormDirty && (
      formData.period_id !== '' ||
      formData.topics_taught !== '' ||
      formData.activities !== '' ||
      formData.notes !== ''
    );
  };

  // Prefill the period when arriving via a "Today's Classes" row click on the
  // dashboard (?period_id=...) — previously this page always opened blank,
  // forcing the teacher to re-pick the exact period they'd just clicked.
  // Only applies once, and only when there's no in-progress draft already
  // selecting a different period (autosave restore takes precedence).
  useEffect(() => {
    const periodIdParam = searchParams.get('period_id');
    if (periodIdParam && !savedFormData?.period_id) {
      setFormData((prev) => (prev.period_id ? prev : { ...prev, period_id: periodIdParam }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: _classes, isLoading: _classesLoading, refetch: refetchClasses } = useTeacherClasses(selectedSchool?.id);
  const { data: reports, isLoading: _reportsLoading, refetch: refetchReports } = useTeacherReports(
    selectedSchool?.id,
    { date: formData.date }
  );
  // Separate query for Recent Reports sidebar — no date filter, shows latest across all dates
  const { data: recentReports, isLoading: recentReportsLoading, refetch: refetchRecentReports } = useTeacherReports(
    selectedSchool?.id,
    { limit: 10 }
  );
  const submitReport = useSubmitReport();

  // Get today's day name (Monday, Tuesday, etc.)
  const todayDayName = useMemo(() => {
    // Parse the date string (format: YYYY-MM-DD)
    const dateStr = formData.date;
    const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues

    // Validate the date
    if (isNaN(date.getTime())) {
      console.error('❌ Invalid date:', dateStr);
      return WEEKDAY_NAMES[new Date().getDay()]; // Fallback to today
    }

    const dayIndex = date.getDay();
    const dayName = WEEKDAY_NAMES[dayIndex];

    return dayName;
  }, [formData.date]);

  const { data: periods, isLoading: periodsLoading, error: _periodsError, refetch: refetchPeriods } = useTeacherPeriods(selectedSchool?.id, todayDayName);
  
  // Force refetch periods when school or day changes to ensure fresh data
  useEffect(() => {
    if (selectedSchool?.id && todayDayName) {
      refetchPeriods();
    }
  }, [selectedSchool?.id, todayDayName, refetchPeriods]);

  // Prefill from a "My Classes" card click (?grade=...) — since a period
  // (not a bare grade) is the actual selectable field, find one of today's
  // periods teaching that grade and select it. Prefers a period that hasn't
  // already been reported today — a teacher can teach the same grade in two
  // different periods the same day, and blindly picking the first match
  // could select an already-submitted one instead of the one they actually
  // meant to report. No-op if the grade isn't scheduled today or a draft is
  // already in progress.
  useEffect(() => {
    const gradeParam = searchParams.get('grade');
    if (!gradeParam || periodsLoading || !periods || savedFormData?.period_id) return;
    const candidates = (periods as PeriodRow[]).filter((p) => p.grade === gradeParam);
    if (candidates.length === 0) return;
    const reportedPeriodIds = new Set(
      (reports as ReportRow[] | undefined ?? [])
        .filter((r) => r.date === formData.date)
        .map((r) => r.period_id)
        .filter(Boolean),
    );
    const match = candidates.find((p) => !reportedPeriodIds.has(p.id)) ?? candidates[0];
    setFormData((prev) => (prev.period_id ? prev : { ...prev, period_id: match.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, periods, periodsLoading, reports]);

  const { data: schedules, refetch: refetchSchedules } = useTeacherSchedules(selectedSchool?.id);

  // Refresh function to reload all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate and refetch all queries
      // Note: Using partial query keys to invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher', 'periods', selectedSchool?.id, todayDayName] }),
        queryClient.invalidateQueries({ queryKey: ['teacher', 'schedules', selectedSchool?.id] }),
        queryClient.invalidateQueries({ queryKey: ['teacher', 'classes', selectedSchool?.id] }),
        queryClient.invalidateQueries({ queryKey: ['teacher', 'reports', selectedSchool?.id] }),
        refetchPeriods(),
        refetchSchedules(),
        refetchClasses(),
        refetchReports(),
        refetchRecentReports()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Use smart refresh hook instead of manual event listeners
  useSmartRefresh({
    queryKeys: [
      ['teacher', 'periods', selectedSchool?.id, todayDayName],
      ['teacher', 'schedules', selectedSchool?.id],
      ['teacher', 'reports', selectedSchool?.id]
    ],
    hasUnsavedData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });


  // Get selected period details for display
  const selectedPeriod = useMemo<PeriodRow | null>(() => {
    if (!formData.period_id || !periods) return null;
     
    return (periods as PeriodRow[]).find((p) => p.id === formData.period_id) || null;
  }, [formData.period_id, periods]);

  // When period is selected, auto-populate grade from the period's schedule
  // Use grade as the primary identifier (same as scheduling)
  useEffect(() => {
    if (!formData.period_id) {
      return; // No period selected
    }
    
    if (periodsLoading) {
      return; // Wait for periods to load
    }
    
    if (!periods || periods.length === 0) {
      console.warn('⚠️ Periods list is empty or not loaded yet');
      return;
    }
    
    // Find the selected period from the periods list
     
    const period = (periods as PeriodRow[]).find((p: PeriodRow) => p.id === formData.period_id);
    
    if (!period) {
      return;
    }
    
    // Get grade directly from the selected period
    // The period gets this information from the schedule (as assigned when period was scheduled)
    const periodGrade = period.grade; // Grade from the schedule
    
    // Auto-populate form fields from period
    // IMPORTANT: Use grade as the primary identifier (same as scheduling)
    if (periodGrade && periodGrade.trim() !== '') {
      setFormData(prev => {
        // Only update if the grade is different to avoid unnecessary re-renders
        if (prev.grade !== periodGrade) {
          return {
            ...prev,
            grade: periodGrade, // Always set from period
            start_time: period.start_time || prev.start_time,
            end_time: period.end_time || prev.end_time,
          };
        }
        return prev;
      });
    } else {
      // Clear grade if period doesn't have it
      setFormData(prev => ({
        ...prev,
        grade: '', // Clear if period doesn't have grade
        start_time: period.start_time || prev.start_time,
        end_time: period.end_time || prev.end_time,
      }));
    }
  }, [formData.period_id, periods, periodsLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedSchool) {
      toast.warning('Please select a school first');
      return;
    }

    if (!formData.period_id) {
      toast.warning('Please select a period');
      return;
    }

    // Use the calculated finalGrade
    if (!finalGrade) {
      toast.warning('Please select a period to get the grade information. If the issue persists, please contact support.');
      console.error('No grade available:', {
        formData,
        selectedPeriod,
        finalGrade
      });
      return;
    }

    // Check if topics_taught has content (not just whitespace)
    const topicsTrimmed = formData.topics_taught?.trim() || '';
    if (!topicsTrimmed) {
      toast.warning('Please enter the topics you taught');
      return;
    }

    try {
      const result = await submitReport.mutateAsync({
        school_id: selectedSchool.id!,
        period_id: formData.period_id,
        grade: finalGrade,
        date: formData.date,
        start_time: formData.start_time || undefined,
        end_time: formData.end_time || undefined,
        topics_taught: formData.topics_taught || undefined,
        activities: formData.activities || undefined,
        notes: formData.notes || undefined,
        student_count: formData.student_count.trim() ? Number(formData.student_count) : undefined
      });

      // Refetch reports to update the UI
      await Promise.all([refetchReports(), refetchRecentReports()]);

      // Reset form
      setFormData({
        period_id: '',
        grade: '', // Use grade instead of class_id
        date: new Date().toLocaleDateString('en-CA'),
        start_time: '',
        end_time: '',
        topics_taught: '',
        activities: '',
        notes: '',
        student_count: ''
      });
      
      // Clear saved form data
      clearFormData('teacher-report-form');
      clearSavedData();

      const attendanceMarked = (result as { attendance_marked_present?: boolean })?.attendance_marked_present;
      toast.success(
        attendanceMarked
          ? 'Report submitted successfully! Your attendance has been marked as Present.'
          : 'Report submitted successfully!',
      );
     
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { json: () => Promise<{ details?: string; error?: string }> }; data?: { details?: string; error?: string }; details?: string; hint?: string };
      console.error('❌ Error submitting report:', {
        error,
        message: err?.message,
        response: err?.response,
        data: err?.data,
        details: err?.details,
        hint: err?.hint
      });
      let errorMessage = 'Unknown error';
      if (err?.response) {
        try {
          const errorData = await err.response.json();
          errorMessage = errorData.details || errorData.error || err.message || 'Failed to submit report';
        } catch {
          errorMessage = err?.message || 'Failed to submit report';
        }
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.data?.details) {
        errorMessage = err.data.details;
      } else if (err?.data?.error) {
        errorMessage = err.data.error;
      }
      toast.error(`Error submitting report: ${errorMessage}`);
    }
  };

  const handleCancel = () => {
    router.push('/lms/teacher');
  };

  // Calculate final grade from the selected period
  // Use grade as the primary identifier (same as scheduling)
  const finalGrade = useMemo(() => {
    // First, check if we have a period selected
    if (!formData.period_id) {
      return null;
    }
    
    // Priority 1: Use grade from form (which should be set from the period)
    if (formData.grade && formData.grade.trim() !== '') {
      return formData.grade;
    }

    // Priority 2: Find period from periods list and get grade
    if (periods && periods.length > 0) {

      const period = (periods as PeriodRow[]).find((p: PeriodRow) => p.id === formData.period_id);
      if (period && period.grade) {
        return period.grade;
      }
    }

    // Priority 3: Use selectedPeriod if available
    if (selectedPeriod && selectedPeriod.grade) {
      return selectedPeriod.grade;
    }

    return null;
  }, [formData.grade, formData.period_id, periods, selectedPeriod]);

   
  const existingReport = (reports as ReportRow[] | undefined)?.find((r) => 
    r.grade === finalGrade && 
    (formData.period_id ? r.period_id === formData.period_id : true)
  );

  // Separate periods into available and already submitted
  const { availablePeriods, submittedPeriods } = useMemo(() => {
    if (!periods || !reports) {
      return { availablePeriods: periods || [], submittedPeriods: [] };
    }

    // Reports for the selected date, keyed by period_id — grade alone isn't
    // unique (a teacher can teach the same grade in two different periods
    // the same day), so grouping by grade only used to hide a second,
    // never-reported period as "Already Submitted" once the first one was.
    const reportsToday = (reports as ReportRow[]).filter((r: ReportRow) => r.date === formData.date);
    const submittedByPeriodId = new Map(
      reportsToday.filter((r) => r.period_id).map((r) => [r.period_id as string, r]),
    );

    const available: PeriodRow[] = [];
    const submitted: (PeriodRow & { report?: ReportRow })[] = [];

    (periods as PeriodRow[]).forEach((period: PeriodRow) => {
      const report = submittedByPeriodId.get(period.id);
      if (report) {
        submitted.push({ ...period, report });
      } else {
        available.push(period);
      }
    });

    return { availablePeriods: available, submittedPeriods: submitted };
  }, [periods, reports, formData.date]);


  if (!selectedSchool) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <p className="text-lg font-medium">Pick a specific school to submit a report</p>
              <p className="text-sm text-gray-600 mt-2">
                A report applies to one school at a time — select it from the &quot;Active School&quot; dropdown above (not &quot;All Schools&quot;) to continue.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Submit Daily Report</h1>
          <p className="text-gray-600 mt-2">
            Submit your daily teaching report for {selectedSchool.name}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing || periodsLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit Report Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily Teaching Report</CardTitle>
              <CardDescription>
                Fill in the details of your teaching session. Your attendance is automatically marked Present once you&apos;ve reported every class scheduled for you that day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Period Selection */}
                <div className="space-y-2">
                  <Label htmlFor="period_id">Period *</Label>
                  <Select
                    value={formData.period_id}
                    onValueChange={(value) => setFormData({ ...formData, period_id: value })}
                    disabled={periodsLoading}
                    required
                  >
                    <SelectTrigger id="period_id">
                      <SelectValue placeholder="Select a period" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodsLoading ? (
                        <SelectItem value="loading" disabled>Loading periods...</SelectItem>
                      ) : availablePeriods && availablePeriods.length > 0 ? (
                         
                        (availablePeriods as PeriodRow[]).map((period: PeriodRow) => {
                          const formatTime = (time: string) => {
                            if (!time) return '';
                            const [hours, minutes] = time.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour % 12 || 12;
                            return `${displayHour}:${minutes} ${ampm}`;
                          };
                          
                          // Display period with grade information from schedule
                          // Grade is the primary identifier
                          const gradeInfo = period.grade ? ` [${period.grade}]` : '';
                          const subjectInfo = period.subject ? ` (${period.subject})` : '';
                          
                          return (
                            <SelectItem key={period.id} value={period.id}>
                              Period {period.period_number} - {formatTime(period.start_time || '')} to {formatTime(period.end_time || '')}{gradeInfo}{subjectInfo}
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-periods" disabled>No periods available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedPeriod && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800 font-medium mb-1">
                        Period information for {todayDayName} (from schedule):
                      </p>
                      {/* Grade from schedule - displayed prominently */}
                      {selectedPeriod.grade && (
                        <p className="text-xs text-blue-700 mb-1">
                          <strong>Grade:</strong> {selectedPeriod.grade} <span className="text-blue-600">(from schedule)</span>
                        </p>
                      )}
                      <p className="text-xs text-blue-700">
                        <strong>Class:</strong> {
                          selectedPeriod.class_name || 
                          (selectedPeriod.subject && selectedPeriod.grade 
                            ? `${selectedPeriod.subject} - ${selectedPeriod.grade}` 
                            : selectedPeriod.subject || selectedPeriod.grade || 'N/A')
                        }
                      </p>
                      {selectedPeriod.subject && (
                        <p className="text-xs text-blue-700">
                          <strong>Subject:</strong> {selectedPeriod.subject}
                        </p>
                      )}
                      <p className="text-xs text-blue-700">
                        <strong>Time:</strong> {selectedPeriod.start_time} - {selectedPeriod.end_time}
                      </p>
                    </div>
                  )}
                  
                  {/* Show submitted periods */}
                  {submittedPeriods && submittedPeriods.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Already Submitted Periods</Label>
                      <div className="space-y-2">
                        {submittedPeriods.map((periodWithReport: PeriodRow & { report?: ReportRow }) => {
                          const formatTime = (time: string) => {
                            if (!time) return '';
                            const [hours, minutes] = time.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour % 12 || 12;
                            return `${displayHour}:${minutes} ${ampm}`;
                          };
                          
                          const gradeInfo = periodWithReport.grade ? ` [${periodWithReport.grade}]` : '';
                          const subjectInfo = periodWithReport.subject ? ` (${periodWithReport.subject})` : '';
                          
                          return (
                            <div 
                              key={periodWithReport.id} 
                              className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-800">
                                  Period {periodWithReport.period_number} - {formatTime(periodWithReport.start_time || '')} to {formatTime(periodWithReport.end_time || '')}{gradeInfo}{subjectInfo}
                                </span>
                              </div>
                              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                Already Submitted
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Class Information (from selected period's schedule) */}
                {finalGrade && selectedPeriod && (
                  <div className="space-y-2">
                    <Label>Class Information (from schedule)</Label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-1">
                      {/* Display grade prominently - this comes from the schedule form */}
                      {/* Display grade */}
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-gray-600">Grade:</span> {
                          selectedPeriod.grade || 'N/A'
                        }
                        {selectedPeriod.subject && selectedPeriod.grade && (
                          <span className="text-gray-500"> • {selectedPeriod.subject}</span>
                        )}
                      </p>
                      {selectedPeriod.subject && (
                        <p className="text-sm text-gray-700">
                          <span className="text-gray-600">Subject:</span> {selectedPeriod.subject}
                        </p>
                      )}
                    </div>
                    {existingReport && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800">
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                          You have already submitted a report for this class today.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={new Date().toLocaleDateString('en-CA')}
                    required
                  />
                </div>

                {/* Time Display (read-only from period) */}
                {(formData.start_time || formData.end_time) && (
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-sm font-medium text-gray-900">
                        {formData.start_time && formData.end_time
                          ? `${formData.start_time} - ${formData.end_time}`
                          : formData.start_time
                          ? `Start: ${formData.start_time}`
                          : formData.end_time
                          ? `End: ${formData.end_time}`
                          : 'Time will be set from selected period'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Topics Taught */}
                <div className="space-y-2">
                  <Label htmlFor="topics_taught">Topics Taught *</Label>
                  <Textarea
                    id="topics_taught"
                    placeholder="Enter the topics you taught today..."
                    value={formData.topics_taught}
                    onChange={(e) => setFormData({ ...formData, topics_taught: e.target.value })}
                    rows={4}
                    required
                  />
                </div>

                {/* Students Present */}
                <div className="space-y-2">
                  <Label htmlFor="student_count">Students Present</Label>
                  <Input
                    id="student_count"
                    type="number"
                    min={0}
                    placeholder="Number of students present"
                    value={formData.student_count}
                    onChange={(e) => setFormData({ ...formData, student_count: e.target.value })}
                  />
                </div>

                {/* Activities */}
                <div className="space-y-2">
                  <Label htmlFor="activities">Activities Conducted</Label>
                  <Textarea
                    id="activities"
                    placeholder="Enter the activities conducted..."
                    value={formData.activities}
                    onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                    rows={4}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes or observations..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <div className="space-y-2">
                  {/* Show why button is disabled */}
                  {(!formData.period_id || !finalGrade || !formData.topics_taught?.trim() || existingReport) && !submitReport.isPending && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">
                      <p className="font-medium mb-1">Please complete the following:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {!formData.period_id && <li>Select a period</li>}
                        {!finalGrade && formData.period_id && (
                          <li>Grade information is missing (try selecting the period again or refresh the page)</li>
                        )}
                        {!formData.topics_taught?.trim() && <li>Enter topics taught</li>}
                        {existingReport && <li>You have already submitted a report for this grade today</li>}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Button
                      type="submit"
                      disabled={submitReport.isPending || !formData.period_id || !finalGrade || !formData.topics_taught?.trim() || !!existingReport}
                      className="flex-1"
                    >
                      {submitReport.isPending ? 'Submitting...' : 'Submit Report'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reports Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Your latest submitted reports</CardDescription>
            </CardHeader>
            <CardContent>
              {recentReportsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : recentReports && recentReports.length > 0 ? (
                <div className="space-y-3">
                  {(recentReports as ReportRow[]).slice(0, 10).map((report: ReportRow) => (
                    <div
                      key={report.id}
                      className="p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {report.grade || report.classes?.[0]?.grade || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {report.date ? new Date(report.date + 'T00:00:00').toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <Badge variant={
                          report.report_status === 'Approved' ? 'default' :
                          report.report_status === 'Rejected' ? 'destructive' :
                          'secondary'
                        }>
                          {report.report_status}
                        </Badge>
                      </div>
                      {report.topics_taught && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {report.topics_taught}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No reports yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
