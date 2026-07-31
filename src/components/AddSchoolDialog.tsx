"use client";

import { useState, useEffect } from "react";
import { DEFAULT_OPERATING_DAYS } from "@/lib/weekday-utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "./ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "./ui/select";
import { 
  School,
  MapPin,
  Phone,
  Mail,
  User,
  Key,
  Building,
  Users,
  GraduationCap,
  Plus,
  RefreshCw,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Trash2,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import WeekdayPicker from "./WeekdayPicker";
import { validatePasswordClient } from "../lib/password-validation";
import { useAutoSaveForm } from "../hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "../lib/form-persistence";
import { adminApi } from "../lib/api/admin.api";
import { toast } from "./ui/toast";

interface AddSchoolDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SchoolFormData {
  // Basic Information
  name: string;
  contact_email: string;
  contact_phone: string;
  established_year: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  affiliation_type: string;
  school_type: string;
  school_logo: string;

  // Operating Days — which weekdays the school holds classes (0=Sun..6=Sat)
  operating_days: number[];

  // School Admin
  school_admin_name: string;
  school_admin_email: string;
  school_admin_phone: string;
  school_admin_temp_password: string;
  
  // Principal Information
  principal_name: string;
  principal_phone: string;
  
  // Academic Details
  grades_offered: string[];
  total_students_estimate: number;
  total_teachers_estimate: number;
  sections_per_grade: Record<string, number>;
  
  // Joining Codes
  code_generation_type: 'auto' | 'manual';
  usage_type: 'single' | 'multiple';
  max_uses: number | null;
  manual_codes: Record<string, string>;
  generated_codes: Record<string, string>;
  disabled_codes: Record<string, boolean>;
  show_joining_codes: boolean;
}

const availableGrades = [
  'Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

const states = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry'
];

const affiliationTypes = [
  'CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Cambridge', 'Other'
];

const schoolTypes = [
  'Public', 'Private', 'Government', 'Semi-Government', 'International', 'Montessori'
];

export default function AddSchoolDialog({ isOpen, onClose, onSuccess }: AddSchoolDialogProps) {
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'basic' | 'operating-days' | 'admin' | 'academic' | 'sections' | 'codes'>('basic');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  // Load saved form data
  const _savedFormData = typeof window !== 'undefined' && isOpen
    ? loadFormData<SchoolFormData>('add-school-dialog-form')
    : null;

  const initialFormData: SchoolFormData = {
    // Basic Information
    name: "",
    contact_email: "",
    contact_phone: "",
    established_year: new Date().getFullYear(),
    address: "",
    city: "",
    state: "",
    pincode: "",
    affiliation_type: "",
    school_type: "",
    school_logo: "",
    // Operating Days
    operating_days: DEFAULT_OPERATING_DAYS,
    // School Admin
    school_admin_name: "",
    school_admin_email: "",
    school_admin_phone: "",
    school_admin_temp_password: "",
    // Principal Information
    principal_name: "",
    principal_phone: "",
    // Academic Details
    grades_offered: [],
    total_students_estimate: 0,
    total_teachers_estimate: 0,
    sections_per_grade: {},
    // Joining code options
    code_generation_type: 'auto',
    usage_type: 'multiple',
    max_uses: null,
    manual_codes: {},
    generated_codes: {},
    disabled_codes: {},
    show_joining_codes: false
  };

  const [formData, setFormData] = useState<SchoolFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});
  const [createdCodesOpen, setCreatedCodesOpen] = useState(false);
  const [createdCodesMap, setCreatedCodesMap] = useState<Record<string, string>>({});

  // Auto-save form data while dialog is open
  const { clearSavedData } = useAutoSaveForm({
    formId: 'add-school-dialog-form',
    formData: { ...formData, currentTab, generated_codes: generatedCodes } as Record<string, unknown>,
    autoSave: isOpen, // Only auto-save when dialog is open
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    markDirty: true,
  });

  // Load saved data or reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Try to load saved data
      const saved = loadFormData<SchoolFormData & { currentTab?: string }>('add-school-dialog-form');
      if (saved) {
        // Merge over the current default shape (not a wholesale replace) so a
        // draft saved before a field like `sections_per_grade` existed still
        // gets a safe default instead of `undefined`.
        setFormData({ ...initialFormData, ...saved, sections_per_grade: saved.sections_per_grade ?? {} });
        setErrors({});
        setGeneratedCodes(saved.generated_codes || {});
        if (saved.currentTab && ['basic', 'operating-days', 'admin', 'academic', 'sections', 'codes'].includes(saved.currentTab)) {
          setCurrentTab(saved.currentTab as 'basic' | 'operating-days' | 'admin' | 'academic' | 'sections' | 'codes');
        }
      } else {
        setFormData(initialFormData);
        setErrors({});
        setGeneratedCodes({});
        setCurrentTab('basic');
      }
    } else {
      // Clear saved data when dialog closes (optional - can keep for recovery)
      // clearFormData('add-school-dialog-form');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialFormData is stable, only reset when isOpen changes
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCreatedCodesOpen(false);
      setCreatedCodesMap({});
    }
  }, [isOpen]);

  // Which tabs still have missing/invalid required fields — drives both the
  // "Please fill all required fields" jump-to-tab action and the tab-header
  // indicators, since the wizard lets users navigate tabs freely without
  // filling earlier ones first.
  const getIncompleteTabs = (): Array<'basic' | 'admin' | 'academic'> => {
    const incomplete: Array<'basic' | 'admin' | 'academic'> = [];

    const basicOk =
      !!formData.name.trim() &&
      !!formData.contact_email.trim() &&
      !!formData.contact_phone.trim() &&
      !!formData.address.trim() &&
      !!formData.principal_name.trim() &&
      !!formData.principal_phone.trim();
    if (!basicOk) incomplete.push('basic');

    const pw = formData.school_admin_temp_password.trim();
    const pwOk = pw.length > 0 && !validatePasswordClient(pw);
    const adminOk =
      !!formData.school_admin_name.trim() &&
      !!formData.school_admin_email.trim() &&
      !!formData.school_admin_phone.trim() &&
      pwOk;
    if (!adminOk) incomplete.push('admin');

    if (formData.grades_offered.length === 0) incomplete.push('academic');

    return incomplete;
  };

  // Check if all required fields are filled
  const isFormComplete = () => getIncompleteTabs().length === 0;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Basic Information validation
    if (!formData.name.trim()) newErrors.name = 'School name is required';
    if (!formData.contact_email.trim()) newErrors.contact_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Please enter a valid email';
    }
    if (!formData.contact_phone.trim()) newErrors.contact_phone = 'Phone number is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    
    // Principal Information validation
    if (!formData.principal_name.trim()) newErrors.principal_name = 'Principal name is required';
    if (!formData.principal_phone.trim()) newErrors.principal_phone = 'Principal phone is required';
    
    // School Admin validation
    if (!formData.school_admin_name.trim()) newErrors.school_admin_name = 'Admin name is required';
    if (!formData.school_admin_email.trim()) newErrors.school_admin_email = 'Admin email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.school_admin_email)) {
      newErrors.school_admin_email = 'Please enter a valid admin email';
    }
    if (!formData.school_admin_phone.trim()) newErrors.school_admin_phone = 'Admin phone is required';
    if (!formData.school_admin_temp_password.trim()) newErrors.school_admin_temp_password = 'Temporary password is required';
    else {
      // Validate password strength (8+ chars, uppercase, lowercase, number)
      const passwordError = validatePasswordClient(formData.school_admin_temp_password);
      if (passwordError) {
        newErrors.school_admin_temp_password = passwordError;
      }
    }
    
    // Academic Details validation
    if (formData.grades_offered.length === 0) newErrors.grades_offered = 'Please select at least one grade';
    if (!formData.school_type.trim()) newErrors.school_type = 'Please select a school type';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

   
  const handleInputChange = (field: keyof SchoolFormData, value: string | number | string[] | Record<string, string> | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleGradeToggle = (grade: string) => {
    setFormData(prev => {
      const isRemoving = prev.grades_offered.includes(grade);
      const sections_per_grade = { ...prev.sections_per_grade };
      if (isRemoving) {
        delete sections_per_grade[grade];
      } else if (!(grade in sections_per_grade)) {
        // Seed with the most common existing count (if any grades are already
        // configured) so newly added grades match what the admin's been using.
        const existingCounts = Object.values(prev.sections_per_grade);
        sections_per_grade[grade] = existingCounts.length > 0 ? existingCounts[0] : 1;
      }
      return {
        ...prev,
        grades_offered: isRemoving
          ? prev.grades_offered.filter((g: string) => g !== grade)
          : [...prev.grades_offered, grade],
        sections_per_grade,
      };
    });
  };

  const updateSectionsForGrade = (grade: string, count: number) => {
    const clamped = Math.min(26, Math.max(1, Math.floor(count) || 1));
    setFormData(prev => ({
      ...prev,
      sections_per_grade: { ...prev.sections_per_grade, [grade]: clamped },
    }));
  };

  const applySectionsToAllGrades = (count: number) => {
    const clamped = Math.min(26, Math.max(1, Math.floor(count) || 1));
    setFormData(prev => {
      const sections_per_grade: Record<string, number> = {};
      prev.grades_offered.forEach(g => { sections_per_grade[g] = clamped; });
      return { ...prev, sections_per_grade };
    });
  };

  // Mirrors the backend's src/common/utils/join-code.util.ts derivation so the
  // preview shows the same shape the server will actually generate. Preview
  // only — the server's schoolCode may differ if it needed a collision suffix.
  const previewSchoolAbbreviation = (name: string): string => {
    const words = name.trim().split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter((w) => w.length > 0);
    const abbr = words.map((w) => w[0]).join('').toUpperCase().slice(0, 6);
    return abbr || 'SCH';
  };
  const previewGradeAbbreviation = (gradeName: string): string => {
    const trimmed = gradeName.trim();
    const gradeMatch = /^grade\s*(\d+)$/i.exec(trimmed);
    if (gradeMatch) return `G${gradeMatch[1]}`;
    if (/^pre-?k$/i.test(trimmed)) return 'PK';
    if (/^kindergarten$/i.test(trimmed)) return 'KG';
    return trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'GR';
  };
  const previewSectionAbbreviation = (letter: string): string => letter;

  const generatePreviewCodes = () => {
    if (formData.grades_offered.length === 0) {
      setGeneratedCodes({});
      return {};
    }

    const schoolAbbr = previewSchoolAbbreviation(formData.name || 'School');
    const codes: Record<string, string> = {};

    formData.grades_offered.forEach((grade) => {
      const gradeAbbr = previewGradeAbbreviation(grade);
      const sectionsCount = formData.sections_per_grade?.[grade] ?? 1;
      const sections = Array.from({ length: Math.min(Math.max(sectionsCount, 1), 26) }, (_, i) =>
        String.fromCharCode(65 + i),
      );
      sections.forEach((section) => {
        const key = `${grade} — Section ${section}`;
        const sectionAbbr = previewSectionAbbreviation(section);
        codes[key] = `YUG-${schoolAbbr}-${gradeAbbr}-${sectionAbbr}`;
      });
    });

    setGeneratedCodes(codes);
    return codes;
  };

  // Auto-regenerate preview codes when grades or sections change (only on codes tab)
  useEffect(() => {
    if (formData.grades_offered.length > 0 && currentTab === 'codes' && formData.name) {
      // Only auto-generate if we're on the codes tab and have a school name
      generatePreviewCodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.grades_offered.length, formData.sections_per_grade, currentTab, formData.name]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast.error("Could not copy");
    }
  };

  const copyAllCodes = async () => {
    const codesText = Object.entries(generatedCodes)
      .map(([grade, code]) => `${grade}: ${code}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(codesText);
      toast.success("All preview lines copied");
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast.error("Could not copy");
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setCurrentTab('basic');
      return;
    }

    setLoading(true);
    
    try {
      const requestData = {
        name: formData.name.trim(),
        contact_email: formData.contact_email.trim(),
        contact_phone: formData.contact_phone.trim(),
        established_year: formData.established_year,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        affiliation_type: formData.affiliation_type,
        school_type: formData.school_type,
        school_logo: formData.school_logo,
        operating_days: formData.operating_days,
        // Principal Information
        principal_name: formData.principal_name.trim(),
        principal_phone: formData.principal_phone.trim(),
        // School Admin Information
        school_admin_name: formData.school_admin_name.trim(),
        school_admin_email: formData.school_admin_email.trim(),
        school_admin_phone: formData.school_admin_phone.trim(),
        school_admin_temp_password: formData.school_admin_temp_password,
        grades_offered: formData.grades_offered,
        total_students_estimate: formData.total_students_estimate,
        total_teachers_estimate: formData.total_teachers_estimate,
        sections_per_grade: formData.sections_per_grade,
        code_generation_type: formData.code_generation_type,
        usage_type: formData.usage_type,
        max_uses: formData.max_uses,
        manual_codes: formData.code_generation_type === 'manual' ? formData.manual_codes : null,
        generated_codes: formData.generated_codes,
        disabled_codes: formData.disabled_codes,
        show_joining_codes: formData.show_joining_codes,
        generate_joining_codes: formData.grades_offered.length > 0
      };

      const res = await adminApi.schools.create(requestData as Record<string, unknown>);
      const httpBody = res.data as {
        data?: { joining_codes?: Record<string, string>; school?: unknown };
        joining_codes?: Record<string, string>;
      };
      const payload = httpBody?.data ?? httpBody;
      const joining_codes = payload?.joining_codes;

      clearFormData("add-school-dialog-form");
      clearSavedData();
      setFormData(initialFormData);
      setCurrentTab('basic');

      toast.success("School created successfully.");
      onSuccess();
      if (joining_codes && Object.keys(joining_codes).length > 0) {
        setCreatedCodesMap(joining_codes);
        setCreatedCodesOpen(true);
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Error creating school:", error);
      toast.error(
        `Could not create school: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: 'basic' | 'operating-days' | 'admin' | 'academic' | 'sections' | 'codes'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'basic', label: 'Basic Information', icon: Building },
    { id: 'operating-days', label: 'Operating Days', icon: Calendar },
    { id: 'admin', label: 'School Admin', icon: Users },
    { id: 'academic', label: 'Academic Details', icon: GraduationCap },
    { id: 'sections', label: 'Sections', icon: Layers },
    { id: 'codes', label: 'Joining Codes', icon: Key }
  ];

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <School className="h-6 w-6 text-blue-600" />
            Add New School
          </DialogTitle>
          <DialogDescription>
            Create a new school with admin access and joining codes
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const incomplete = (getIncompleteTabs() as string[]).includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    currentTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {incomplete && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-orange-500"
                      aria-label="Missing required fields"
                      title="Missing required fields"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Basic Information Tab */}
          {currentTab === 'basic' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    School Information
                  </CardTitle>
                  <CardDescription>
                    Enter the basic details of the school
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">
                        School Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter school name"
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_email" className="text-sm font-medium">
                        School Email <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          placeholder="info@school.edu"
                          className={`pl-10 ${errors.contact_email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.contact_email && <p className="text-sm text-red-500">{errors.contact_email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_phone" className="text-sm font-medium">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="contact_phone"
                          type="tel"
                          value={formData.contact_phone}
                          onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                          placeholder="+91 9876543210"
                          className={`pl-10 ${errors.contact_phone ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.contact_phone && <p className="text-sm text-red-500">{errors.contact_phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="established_year" className="text-sm font-medium">
                        Established Year
                      </Label>
                      <Input
                        id="established_year"
                        type="number"
                        value={formData.established_year}
                        onChange={(e) => handleInputChange('established_year', parseInt(e.target.value) || new Date().getFullYear())}
                        placeholder="2024"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="principal_name" className="text-sm font-medium">
                        Principal Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="principal_name"
                          value={formData.principal_name}
                          onChange={(e) => handleInputChange('principal_name', e.target.value)}
                          placeholder="Enter principal name"
                          className={`pl-10 ${errors.principal_name ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.principal_name && <p className="text-sm text-red-500">{errors.principal_name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="principal_phone" className="text-sm font-medium">
                        Principal Phone <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="principal_phone"
                          type="tel"
                          value={formData.principal_phone}
                          onChange={(e) => handleInputChange('principal_phone', e.target.value)}
                          placeholder="+91 9876543210"
                          className={`pl-10 ${errors.principal_phone ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.principal_phone && <p className="text-sm text-red-500">{errors.principal_phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Enter complete address"
                        className={`pl-10 ${errors.address ? 'border-red-500' : ''}`}
                        rows={3}
                      />
                    </div>
                    {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="Enter city"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-medium">State</Label>
                      <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pincode" className="text-sm font-medium">Pincode</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => handleInputChange('pincode', e.target.value)}
                        placeholder="123456"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="affiliation_type" className="text-sm font-medium">Affiliation Type</Label>
                      <Select value={formData.affiliation_type} onValueChange={(value) => handleInputChange('affiliation_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select affiliation" />
                        </SelectTrigger>
                        <SelectContent>
                          {affiliationTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school_type" className="text-sm font-medium">School Type <span className="text-red-500">*</span></Label>
                      <Select value={formData.school_type} onValueChange={(value) => handleInputChange('school_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select school type" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.school_type && <p className="text-sm text-red-500">{errors.school_type}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Operating Days Tab */}
          {currentTab === 'operating-days' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Operating Days
                  </CardTitle>
                  <CardDescription>
                    Which days does this school hold classes? Teachers can only be scheduled to
                    work, and classes can only be scheduled, on days selected here.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeekdayPicker
                    idPrefix="school_operating_days"
                    value={formData.operating_days}
                    onChange={(days) => setFormData({ ...formData, operating_days: days })}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* School Admin Tab */}
          {currentTab === 'admin' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    School Administrator
                  </CardTitle>
                  <CardDescription>
                    Create the school administrator account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="school_admin_name" className="text-sm font-medium">
                        School Admin Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="school_admin_name"
                          value={formData.school_admin_name}
                          onChange={(e) => handleInputChange('school_admin_name', e.target.value)}
                          placeholder="Enter school admin name"
                          className={`pl-10 ${errors.school_admin_name ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.school_admin_name && <p className="text-sm text-red-500">{errors.school_admin_name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school_admin_email" className="text-sm font-medium">
                        School Admin Email <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="school_admin_email"
                          type="email"
                          value={formData.school_admin_email}
                          onChange={(e) => handleInputChange('school_admin_email', e.target.value)}
                          placeholder="admin@school.edu"
                          className={`pl-10 ${errors.school_admin_email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.school_admin_email && <p className="text-sm text-red-500">{errors.school_admin_email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school_admin_phone" className="text-sm font-medium">
                        School Admin Phone <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="school_admin_phone"
                          type="tel"
                          value={formData.school_admin_phone}
                          onChange={(e) => handleInputChange('school_admin_phone', e.target.value)}
                          placeholder="+91 9876543210"
                          className={`pl-10 ${errors.school_admin_phone ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.school_admin_phone && <p className="text-sm text-red-500">{errors.school_admin_phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="school_admin_temp_password" className="text-sm font-medium">
                        Temporary Password <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="school_admin_temp_password"
                          type={showAdminPassword ? "text" : "password"}
                          value={formData.school_admin_temp_password}
                          onChange={(e) => handleInputChange('school_admin_temp_password', e.target.value)}
                          placeholder="Enter password (min 8: uppercase, lowercase, number)"
                          className={`pl-10 pr-10 ${errors.school_admin_temp_password ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label={showAdminPassword ? "Hide password" : "Show password"}
                        >
                          {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.school_admin_temp_password && <p className="text-sm text-red-500">{errors.school_admin_temp_password}</p>}
                      <p className="text-xs text-gray-500">This will be the initial password for the school admin account</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Academic Details Tab */}
          {currentTab === 'academic' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    Academic Information
                  </CardTitle>
                  <CardDescription>
                    Configure academic details and capacity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      Grades Offered <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {availableGrades.map((grade) => (
                        <div key={grade} className="flex items-center space-x-2">
                          <Checkbox
                            id={grade}
                            checked={formData.grades_offered.includes(grade)}
                            onCheckedChange={() => handleGradeToggle(grade)}
                          />
                          <Label htmlFor={grade} className="text-sm font-normal">
                            {grade}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.grades_offered && <p className="text-sm text-red-500">{errors.grades_offered}</p>}
                    <p className="text-xs text-gray-500">
                      Section counts for each grade are configured on the next step.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="total_students_estimate" className="text-sm font-medium">
                        Total Students (Estimate)
                      </Label>
                      <Input
                        id="total_students_estimate"
                        type="number"
                        value={formData.total_students_estimate}
                        onChange={(e) => handleInputChange('total_students_estimate', parseInt(e.target.value) || 0)}
                        placeholder="100"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="total_teachers_estimate" className="text-sm font-medium">
                        Total Teachers (Estimate)
                      </Label>
                      <Input
                        id="total_teachers_estimate"
                        type="number"
                        value={formData.total_teachers_estimate}
                        onChange={(e) => handleInputChange('total_teachers_estimate', parseInt(e.target.value) || 0)}
                        placeholder="10"
                        min="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sections Tab */}
          {currentTab === 'sections' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    Grade Sections
                  </CardTitle>
                  <CardDescription>
                    Set how many sections each grade has — schools often need different
                    section counts per grade (e.g. 2 sections for Grade 4, 3 for Grade 7).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.grades_offered.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No grades selected yet. Go back to <strong>Academic Details</strong> to
                      pick at least one grade first.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="apply_all_sections" className="text-xs font-medium text-gray-600">
                            Apply to all grades
                          </Label>
                          <Input
                            id="apply_all_sections"
                            type="number"
                            min="1"
                            max="26"
                            placeholder="e.g. 2"
                            className="w-28"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const value = parseInt((e.target as HTMLInputElement).value, 10);
                                if (!isNaN(value)) applySectionsToAllGrades(value);
                              }
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.getElementById('apply_all_sections') as HTMLInputElement | null;
                            const value = input ? parseInt(input.value, 10) : NaN;
                            if (!isNaN(value)) applySectionsToAllGrades(value);
                          }}
                        >
                          Apply to all
                        </Button>
                        <p className="text-xs text-gray-500 flex-1 min-w-[200px]">
                          Quick way to set the same count everywhere — you can still fine-tune
                          individual grades below.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {availableGrades
                          .filter((grade) => formData.grades_offered.includes(grade))
                          .map((grade) => {
                            const count = formData.sections_per_grade?.[grade] ?? 1;
                            const letters = Array.from({ length: Math.min(count, 26) }, (_, i) =>
                              String.fromCharCode(65 + i),
                            ).join(', ');
                            return (
                              <div
                                key={grade}
                                className="flex items-center gap-4 rounded-md border border-gray-200 p-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{grade}</p>
                                  <p className="text-xs text-gray-500 truncate">
                                    Section{count !== 1 ? 's' : ''}: {letters}
                                  </p>
                                </div>
                                <Input
                                  type="number"
                                  min="1"
                                  max="26"
                                  value={count}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    updateSectionsForGrade(grade, isNaN(value) ? 1 : value);
                                  }}
                                  className="w-20"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleGradeToggle(grade)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  aria-label={`Remove ${grade}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                      </div>

                      {availableGrades.some((g) => !formData.grades_offered.includes(g)) && (
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <Label htmlFor="add_grade_select" className="text-sm font-medium">
                            Add a missing grade
                          </Label>
                          <Select
                            value=""
                            onValueChange={(grade) => { if (grade) handleGradeToggle(grade); }}
                          >
                            <SelectTrigger id="add_grade_select" className="w-full md:w-64">
                              <SelectValue placeholder="Select a grade to add" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableGrades
                                .filter((g) => !formData.grades_offered.includes(g))
                                .map((g) => (
                                  <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Joining Codes Tab */}
          {currentTab === 'codes' && (
            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-600" />
                    Joining Codes Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure joining codes for student self-registration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.grades_offered.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Please select grades in the Academic Details tab first</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Code Generation Type</Label>
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="auto"
                                checked={formData.code_generation_type === 'auto'}
                                onChange={(e) => handleInputChange('code_generation_type', e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Automatic</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="manual"
                                checked={formData.code_generation_type === 'manual'}
                                onChange={(e) => handleInputChange('code_generation_type', e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Manual</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Usage Type</Label>
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="single"
                                checked={formData.usage_type === 'single'}
                                onChange={(e) => handleInputChange('usage_type', e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Single Use</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="multiple"
                                checked={formData.usage_type === 'multiple'}
                                onChange={(e) => handleInputChange('usage_type', e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Multiple Use</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {formData.usage_type === 'multiple' && (
                        <div className="space-y-2">
                          <Label htmlFor="max_uses" className="text-sm font-medium">Maximum Uses (Optional)</Label>
                          <Input
                            id="max_uses"
                            type="number"
                            value={formData.max_uses || ''}
                            onChange={(e) => handleInputChange('max_uses', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="Leave empty for unlimited"
                            min="1"
                          />
                        </div>
                      )}

                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Preview values use the same shape as live codes (YUG- plus random characters). Final codes are assigned on the server when you create the school.
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Preview Joining Codes</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generatePreviewCodes}
                            className="flex items-center gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Generate Preview
                          </Button>
                        </div>

                        {Object.keys(generatedCodes).length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600">
                                {Object.keys(generatedCodes).length} joining code(s) will be generated
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copyAllCodes}
                                className="flex items-center gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy All
                              </Button>
                            </div>
                            
                            <div className="grid gap-3">
                              {Object.entries(generatedCodes).map(([grade, code]) => (
                                <div key={grade} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">{grade}</Badge>
                                    <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                                      {code}
                                    </code>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(code)}
                                    className="flex items-center gap-2"
                                  >
                                    <Copy className="h-4 w-4" />
                                    Copy
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="pt-6 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-500">
              {formData.grades_offered.length > 0 && (
                <span className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {(() => {
                    const totalCodes = formData.grades_offered.reduce(
                      (sum, grade) => sum + Math.max(formData.sections_per_grade?.[grade] ?? 1, 1),
                      0,
                    );
                    return `${totalCodes} joining code(s) will be generated across ${formData.grades_offered.length} grade${formData.grades_offered.length !== 1 ? 's' : ''}`;
                  })()}
                </span>
              )}
              {!isFormComplete() && (
                <button
                  type="button"
                  onClick={() => {
                    const incomplete = getIncompleteTabs();
                    if (incomplete.length > 0) setCurrentTab(incomplete[0]);
                  }}
                  className="flex items-center gap-2 text-orange-600 hover:underline"
                >
                  <AlertCircle className="h-4 w-4" />
                  Please fill all required fields — click to go there
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              {currentTab !== tabs[0].id && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
                    if (currentIndex > 0) {
                      setCurrentTab(tabs[currentIndex - 1].id);
                    }
                  }}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
              {currentTab !== tabs[tabs.length - 1].id ? (
                <Button
                  onClick={() => {
                    const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
                    if (currentIndex < tabs.length - 1) {
                      setCurrentTab(tabs[currentIndex + 1].id);
                    }
                  }}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || !isFormComplete()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create School
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={createdCodesOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreatedCodesOpen(false);
          setCreatedCodesMap({});
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Joining codes created</DialogTitle>
          <DialogDescription>
            Save these codes securely. You can also open &quot;Manage Joining Codes&quot; from the schools list for this school.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 font-mono text-sm">
          {Object.entries(createdCodesMap).map(([label, code]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-gray-100 py-2">
              <span className="text-gray-600 shrink-0">{label}</span>
              <span className="font-semibold">{code}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  Object.entries(createdCodesMap)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n"),
                );
                toast.success("Copied all codes");
              } catch {
                toast.error("Copy failed");
              }
            }}
            variant="outline"
          >
            Copy all
          </Button>
          <Button
            onClick={() => {
              setCreatedCodesOpen(false);
              setCreatedCodesMap({});
              onClose();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
