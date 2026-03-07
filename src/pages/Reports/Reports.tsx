import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,

  Alert,
  AlertTitle,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  CircularProgress,
  Snackbar,
  InputAdornment,

  List,
  ListItem,
  ListItemText,
  Tooltip,
  TablePagination,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Assessment,

  FilterList,
  Search,
  TrendingUp,
  People,
  LocalHospital,
  Schedule,
  Security,
  Visibility,
  Download,
  Share,

  Refresh,
  Settings,
  Help,

  Dashboard,

  Analytics,
  Business,
  MonetizationOn,
  EventNote,
  HealthAndSafety,
  AdminPanelSettings,
  PersonAdd,
  CalendarToday,
  Payment,
  History,
  CheckCircle,
  Warning,
  ErrorOutline,
  Info,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '../../contexts/AuthContext';

// Report interfaces
interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactElement;
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredPermissions: string[];
  parameters: ReportParameter[];
}

interface ReportParameter {
  id: string;
  name: string;
  type: 'date' | 'daterange' | 'select' | 'multiselect' | 'boolean' | 'text' | 'number';
  required: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'expired';
  createdAt: string;
  completedAt?: string;
  parameters: Record<string, any>;
  downloadUrl?: string;
  expiresAt?: string;
  fileSize?: number;
  format: 'pdf' | 'xlsx' | 'csv' | 'json';
  generatedBy: string;
  error?: string;
}

interface ReportAnalytics {
  totalReports: number;
  reportsThisMonth: number;
  averageGenerationTime: number;
  mostUsedTemplate: string;
  successRate: number;
  popularCategories: { category: string; count: number }[];
}

// Mock data
const reportTemplates: ReportTemplate[] = [
  // User Analytics Reports
  {
    id: 'user-activity',
    name: 'User Activity Report',
    category: 'User Analytics',
    description: 'Comprehensive analysis of user login patterns, session duration, and feature usage',
    icon: <People />,
    estimatedTime: '2-5 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'manager'],
    parameters: [
      {
        id: 'dateRange',
        name: 'Date Range',
        type: 'daterange',
        required: true,
      },
      {
        id: 'userTypes',
        name: 'User Types',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'admin', label: 'Administrators' },
          { value: 'therapist', label: 'Therapists' },
          { value: 'staff', label: 'Staff Members' },
          { value: 'patient', label: 'Patients' },
        ],
      },
      {
        id: 'includeInactive',
        name: 'Include Inactive Users',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    ],
  },
  {
    id: 'user-registration',
    name: 'User Registration Trends',
    category: 'User Analytics',
    description: 'Analysis of user registration patterns, growth rates, and demographic breakdown',
    icon: <PersonAdd />,
    estimatedTime: '1-3 minutes',
    complexity: 'simple',
    requiredPermissions: ['admin'],
    parameters: [
      {
        id: 'period',
        name: 'Time Period',
        type: 'select',
        required: true,
        options: [
          { value: '30d', label: 'Last 30 Days' },
          { value: '90d', label: 'Last 3 Months' },
          { value: '1y', label: 'Last Year' },
          { value: 'custom', label: 'Custom Range' },
        ],
        defaultValue: '30d',
      },
    ],
  },

  // Patient Analytics Reports
  {
    id: 'patient-demographics',
    name: 'Patient Demographics Report',
    category: 'Patient Analytics',
    description: 'Statistical breakdown of patient demographics, insurance coverage, and treatment patterns',
    icon: <LocalHospital />,
    estimatedTime: '3-7 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'therapist', 'manager'],
    parameters: [
      {
        id: 'includeInactive',
        name: 'Include Inactive Patients',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      {
        id: 'ageGroups',
        name: 'Age Groups',
        type: 'multiselect',
        required: false,
        options: [
          { value: '0-17', label: 'Pediatric (0-17)' },
          { value: '18-34', label: 'Young Adult (18-34)' },
          { value: '35-54', label: 'Adult (35-54)' },
          { value: '55+', label: 'Senior (55+)' },
        ],
      },
    ],
  },
  {
    id: 'patient-outcomes',
    name: 'Treatment Outcomes Report',
    category: 'Patient Analytics',
    description: 'Analysis of patient treatment progress, outcome measures, and success rates',
    icon: <HealthAndSafety />,
    estimatedTime: '5-10 minutes',
    complexity: 'complex',
    requiredPermissions: ['admin', 'therapist'],
    parameters: [
      {
        id: 'dateRange',
        name: 'Treatment Period',
        type: 'daterange',
        required: true,
      },
      {
        id: 'therapists',
        name: 'Therapists',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'all', label: 'All Therapists' },
          { value: 'dr-smith', label: 'Dr. Sarah Smith' },
          { value: 'dr-johnson', label: 'Dr. Michael Johnson' },
        ],
      },
    ],
  },

  // Financial Reports
  {
    id: 'revenue-analysis',
    name: 'Revenue Analysis Report',
    category: 'Financial',
    description: 'Comprehensive revenue breakdown by service type, therapist, and time period',
    icon: <MonetizationOn />,
    estimatedTime: '3-6 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'billing'],
    parameters: [
      {
        id: 'fiscalPeriod',
        name: 'Fiscal Period',
        type: 'select',
        required: true,
        options: [
          { value: 'current-month', label: 'Current Month' },
          { value: 'last-month', label: 'Last Month' },
          { value: 'current-quarter', label: 'Current Quarter' },
          { value: 'last-quarter', label: 'Last Quarter' },
          { value: 'year-to-date', label: 'Year to Date' },
          { value: 'custom', label: 'Custom Range' },
        ],
        defaultValue: 'current-month',
      },
      {
        id: 'groupBy',
        name: 'Group By',
        type: 'select',
        required: true,
        options: [
          { value: 'therapist', label: 'By Therapist' },
          { value: 'service', label: 'By Service Type' },
          { value: 'insurance', label: 'By Insurance Provider' },
          { value: 'payment-method', label: 'By Payment Method' },
        ],
        defaultValue: 'therapist',
      },
    ],
  },
  {
    id: 'billing-summary',
    name: 'Billing Summary Report',
    category: 'Financial',
    description: 'Summary of billing activities, payment collections, and outstanding balances',
    icon: <Payment />,
    estimatedTime: '2-4 minutes',
    complexity: 'simple',
    requiredPermissions: ['admin', 'billing'],
    parameters: [
      {
        id: 'includePending',
        name: 'Include Pending Invoices',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
  },

  // Appointment Reports
  {
    id: 'appointment-analytics',
    name: 'Appointment Analytics',
    category: 'Scheduling',
    description: 'Analysis of appointment booking patterns, no-show rates, and scheduling efficiency',
    icon: <CalendarToday />,
    estimatedTime: '3-5 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'therapist', 'scheduler'],
    parameters: [
      {
        id: 'dateRange',
        name: 'Date Range',
        type: 'daterange',
        required: true,
      },
      {
        id: 'appointmentTypes',
        name: 'Appointment Types',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'initial', label: 'Initial Consultation' },
          { value: 'followup', label: 'Follow-up' },
          { value: 'therapy', label: 'Therapy Session' },
          { value: 'assessment', label: 'Assessment' },
        ],
      },
    ],
  },
  {
    id: 'no-show-analysis',
    name: 'No-Show Analysis Report',
    category: 'Scheduling',
    description: 'Detailed analysis of appointment no-shows, patterns, and impact on revenue',
    icon: <EventNote />,
    estimatedTime: '2-4 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'manager'],
    parameters: [
      {
        id: 'timeFrame',
        name: 'Analysis Time Frame',
        type: 'select',
        required: true,
        options: [
          { value: '30d', label: 'Last 30 Days' },
          { value: '90d', label: 'Last 3 Months' },
          { value: '6m', label: 'Last 6 Months' },
          { value: '1y', label: 'Last Year' },
        ],
        defaultValue: '90d',
      },
    ],
  },

  // Compliance Reports
  {
    id: 'hipaa-audit',
    name: 'HIPAA Audit Trail',
    category: 'Compliance',
    description: 'Comprehensive HIPAA compliance audit including access logs, data modifications, and security events',
    icon: <Security />,
    estimatedTime: '5-15 minutes',
    complexity: 'complex',
    requiredPermissions: ['admin', 'compliance'],
    parameters: [
      {
        id: 'auditPeriod',
        name: 'Audit Period',
        type: 'daterange',
        required: true,
      },
      {
        id: 'eventTypes',
        name: 'Event Types',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'login', label: 'Login Events' },
          { value: 'data-access', label: 'Data Access' },
          { value: 'data-modification', label: 'Data Modifications' },
          { value: 'security', label: 'Security Events' },
          { value: 'export', label: 'Data Exports' },
        ],
      },
    ],
  },
  {
    id: 'data-breach-assessment',
    name: 'Data Breach Assessment',
    category: 'Compliance',
    description: 'Security incident analysis and potential data breach assessment report',
    icon: <AdminPanelSettings />,
    estimatedTime: '10-20 minutes',
    complexity: 'complex',
    requiredPermissions: ['admin'],
    parameters: [
      {
        id: 'incidentDate',
        name: 'Incident Date Range',
        type: 'daterange',
        required: true,
      },
      {
        id: 'severity',
        name: 'Minimum Severity Level',
        type: 'select',
        required: true,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ],
        defaultValue: 'medium',
      },
    ],
  },

  // System Performance Reports
  {
    id: 'system-performance',
    name: 'System Performance Report',
    category: 'Technical',
    description: 'System performance metrics, uptime analysis, and resource utilization',
    icon: <Dashboard />,
    estimatedTime: '2-5 minutes',
    complexity: 'moderate',
    requiredPermissions: ['admin', 'tech'],
    parameters: [
      {
        id: 'metrics',
        name: 'Performance Metrics',
        type: 'multiselect',
        required: true,
        options: [
          { value: 'uptime', label: 'System Uptime' },
          { value: 'response-time', label: 'Response Time' },
          { value: 'cpu-usage', label: 'CPU Usage' },
          { value: 'memory-usage', label: 'Memory Usage' },
          { value: 'database-performance', label: 'Database Performance' },
        ],
      },
    ],
  },
];

const mockGeneratedReports: GeneratedReport[] = [
  {
    id: 'report-1',
    templateId: 'user-activity',
    templateName: 'User Activity Report',
    category: 'User Analytics',
    status: 'completed',
    createdAt: '2025-11-05T10:30:00Z',
    completedAt: '2025-11-05T10:32:15Z',
    parameters: { dateRange: { start: '2025-10-01', end: '2025-10-31' } },
    downloadUrl: '/api/reports/download/report-1.pdf',
    expiresAt: '2025-11-12T10:30:00Z',
    fileSize: 2.4,
    format: 'pdf',
    generatedBy: 'Admin User',
  },
  {
    id: 'report-2',
    templateId: 'revenue-analysis',
    templateName: 'Revenue Analysis Report',
    category: 'Financial',
    status: 'completed',
    createdAt: '2025-11-05T09:15:00Z',
    completedAt: '2025-11-05T09:18:45Z',
    parameters: { fiscalPeriod: 'current-month', groupBy: 'therapist' },
    downloadUrl: '/api/reports/download/report-2.xlsx',
    expiresAt: '2025-11-12T09:15:00Z',
    fileSize: 1.8,
    format: 'xlsx',
    generatedBy: 'Billing Manager',
  },
  {
    id: 'report-3',
    templateId: 'hipaa-audit',
    templateName: 'HIPAA Audit Trail',
    category: 'Compliance',
    status: 'generating',
    createdAt: '2025-11-05T11:00:00Z',
    parameters: { auditPeriod: { start: '2025-10-01', end: '2025-10-31' } },
    format: 'pdf',
    generatedBy: 'Compliance Officer',
  },
  {
    id: 'report-4',
    templateId: 'patient-demographics',
    templateName: 'Patient Demographics Report',
    category: 'Patient Analytics',
    status: 'failed',
    createdAt: '2025-11-05T08:45:00Z',
    parameters: { includeInactive: false },
    format: 'pdf',
    generatedBy: 'Clinical Manager',
    error: 'Insufficient data access permissions',
  },
];

const reportAnalytics: ReportAnalytics = {
  totalReports: 156,
  reportsThisMonth: 23,
  averageGenerationTime: 4.2,
  mostUsedTemplate: 'Revenue Analysis Report',
  successRate: 94.2,
  popularCategories: [
    { category: 'Financial', count: 45 },
    { category: 'Patient Analytics', count: 38 },
    { category: 'User Analytics', count: 32 },
    { category: 'Compliance', count: 25 },
    { category: 'Scheduling', count: 16 },
  ],
};

const Reports: React.FC = () => {
  const { state } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [reportParameters, setReportParameters] = useState<Record<string, any>>({});
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(mockGeneratedReports);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Get unique categories
  const categories = Array.from(new Set(reportTemplates.map(template => template.category)));

  // Filter templates
  const filteredTemplates = reportTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  // Get status color and icon
  const getStatusDisplay = (status: GeneratedReport['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'default' as const, icon: <Schedule />, label: 'Pending' };
      case 'generating':
        return { color: 'primary' as const, icon: <CircularProgress size={16} />, label: 'Generating' };
      case 'completed':
        return { color: 'success' as const, icon: <CheckCircle />, label: 'Completed' };
      case 'failed':
        return { color: 'error' as const, icon: <ErrorOutline />, label: 'Failed' };
      case 'expired':
        return { color: 'warning' as const, icon: <Warning />, label: 'Expired' };
      default:
        return { color: 'default' as const, icon: <Info />, label: 'Unknown' };
    }
  };

  // Get complexity color
  const getComplexityColor = (complexity: ReportTemplate['complexity']) => {
    switch (complexity) {
      case 'simple': return 'success';
      case 'moderate': return 'warning';
      case 'complex': return 'error';
      default: return 'default';
    }
  };

  // Handle generate report
  const handleGenerateReport = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    
    // Initialize parameters with default values
    const initialParams: Record<string, any> = {};
    template.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialParams[param.id] = param.defaultValue;
      }
    });
    setReportParameters(initialParams);
    
    setGenerateDialogOpen(true);
  };

  // Submit report generation
  const submitReportGeneration = () => {
    if (!selectedTemplate) return;

    const newReport: GeneratedReport = {
      id: `report-${Date.now()}`,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      category: selectedTemplate.category,
      status: 'generating',
      createdAt: new Date().toISOString(),
      parameters: reportParameters,
      format: 'pdf',
      generatedBy: `${state.user?.firstName} ${state.user?.lastName}`,
    };

    setGeneratedReports(prev => [newReport, ...prev]);
    setGenerateDialogOpen(false);
    setSnackbarMessage('Report generation started successfully!');
    setSnackbarOpen(true);

    // Simulate report completion
    setTimeout(() => {
      setGeneratedReports(prev => 
        prev.map(report => 
          report.id === newReport.id
            ? {
                ...report,
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
                downloadUrl: `/api/reports/download/${newReport.id}.pdf`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                fileSize: Math.round((Math.random() * 5 + 0.5) * 10) / 10,
              }
            : report
        )
      );
    }, 3000 + Math.random() * 5000);
  };

  // Download report
  const downloadReport = (report: GeneratedReport) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank');
    }
  };

  // Render parameter input
  const renderParameterInput = (parameter: ReportParameter) => {
    const value = reportParameters[parameter.id] || parameter.defaultValue || '';
    
    switch (parameter.type) {
      case 'select':
        return (
          <FormControl fullWidth key={parameter.id} sx={{ mb: 2 }}>
            <InputLabel>{parameter.name} {parameter.required && '*'}</InputLabel>
            <Select
              value={value}
              label={parameter.name}
              onChange={(e) => setReportParameters(prev => ({ ...prev, [parameter.id]: e.target.value }))}
              required={parameter.required}
            >
              {parameter.options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
        
      case 'multiselect':
        return (
          <FormControl fullWidth key={parameter.id} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {parameter.name} {parameter.required && '*'}
            </Typography>
            <FormGroup>
              {parameter.options?.map(option => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={(value as string[])?.includes(option.value) || false}
                      onChange={(e) => {
                        const currentValues = (value as string[]) || [];
                        const newValues = e.target.checked
                          ? [...currentValues, option.value]
                          : currentValues.filter(v => v !== option.value);
                        setReportParameters(prev => ({ ...prev, [parameter.id]: newValues }));
                      }}
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>
          </FormControl>
        );
        
      case 'boolean':
        return (
          <FormControlLabel
            key={parameter.id}
            sx={{ mb: 2, display: 'block' }}
            control={
              <Switch
                checked={value as boolean || false}
                onChange={(e) => setReportParameters(prev => ({ ...prev, [parameter.id]: e.target.checked }))}
              />
            }
            label={`${parameter.name} ${parameter.required ? '*' : ''}`}
          />
        );
        
      case 'daterange':
        return (
          <Grid container spacing={2} key={parameter.id} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {parameter.name} {parameter.required && '*'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <DatePicker
                label="Start Date"
                value={value?.start ? new Date(value.start) : null}
                onChange={(date) => setReportParameters(prev => ({ 
                  ...prev, 
                  [parameter.id]: { ...prev[parameter.id], start: date?.toISOString().split('T')[0] }
                }))}
                slotProps={{ textField: { fullWidth: true, required: parameter.required } }}
              />
            </Grid>
            <Grid item xs={6}>
              <DatePicker
                label="End Date"
                value={value?.end ? new Date(value.end) : null}
                onChange={(date) => setReportParameters(prev => ({ 
                  ...prev, 
                  [parameter.id]: { ...prev[parameter.id], end: date?.toISOString().split('T')[0] }
                }))}
                slotProps={{ textField: { fullWidth: true, required: parameter.required } }}
              />
            </Grid>
          </Grid>
        );
        
      case 'date':
        return (
          <DatePicker
            key={parameter.id}
            label={`${parameter.name} ${parameter.required ? '*' : ''}`}
            value={value ? new Date(value) : null}
            onChange={(date) => setReportParameters(prev => ({ 
              ...prev, 
              [parameter.id]: date?.toISOString().split('T')[0]
            }))}
            slotProps={{ textField: { fullWidth: true, required: parameter.required, sx: { mb: 2 } } }}
          />
        );
        
      default:
        return (
          <TextField
            key={parameter.id}
            fullWidth
            label={parameter.name}
            value={value}
            onChange={(e) => setReportParameters(prev => ({ ...prev, [parameter.id]: e.target.value }))}
            required={parameter.required}
            type={parameter.type === 'number' ? 'number' : 'text'}
            sx={{ mb: 2 }}
          />
        );
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Reports & Analytics Center
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Button variant="outlined" startIcon={<Settings />} fullWidth={isMobile}>
            Report Settings
          </Button>
          <Button variant="outlined" startIcon={<Help />} fullWidth={isMobile}>
            Help & Guide
          </Button>
        </Box>
      </Box>

      {/* Analytics Dashboard */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Assessment color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="primary.main">
                {reportAnalytics.totalReports}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Reports
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUp color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {reportAnalytics.reportsThisMonth}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This Month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Schedule color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {reportAnalytics.averageGenerationTime}min
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Generation Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {reportAnalytics.successRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Business color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                {reportAnalytics.popularCategories[0]?.count || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Top Category
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
        >
          <Tab label="Report Templates" icon={<Assessment />} iconPosition="start" />
          <Tab 
            label={
              <Badge badgeContent={generatedReports.length} color="primary">
                Generated Reports
              </Badge>
            }
            icon={<History />} 
            iconPosition="start" 
          />
          <Tab label="Analytics Dashboard" icon={<Analytics />} iconPosition="start" />
        </Tabs>

        {/* Report Templates Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Filters */}
            <Grid container spacing={3} alignItems="center" sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search report templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories.map(category => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<FilterList />}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>

            {/* Report Templates Grid */}
            <Grid container spacing={3}>
              {filteredTemplates.map(template => (
                <Grid item xs={12} md={6} lg={4} key={template.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {React.cloneElement(template.icon, { color: 'primary', fontSize: 'large' })}
                        <Box sx={{ ml: 2 }}>
                          <Typography variant="h6">{template.name}</Typography>
                          <Chip 
                            label={template.category} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Est. Time: {template.estimatedTime}
                        </Typography>
                        <Chip 
                          label={template.complexity} 
                          size="small" 
                          color={getComplexityColor(template.complexity) as any}
                        />
                      </Box>

                      {template.parameters.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Parameters: {template.parameters.length}
                        </Typography>
                      )}
                    </CardContent>

                    <CardContent sx={{ pt: 0 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Assessment />}
                        onClick={() => handleGenerateReport(template)}
                      >
                        Generate Report
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {filteredTemplates.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No report templates found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search criteria or clearing filters
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Generated Reports Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
              <Typography variant="h6">Generated Reports</Typography>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                fullWidth={isMobile}
                onClick={() => {
                  // Refresh reports list
                }}
              >
                Refresh
              </Button>
            </Box>

            {isMobile ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {generatedReports
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((report) => {
                    const statusDisplay = getStatusDisplay(report.status);
                    return (
                      <Card key={report.id} variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2">{report.templateName}</Typography>
                          <Typography variant="caption" color="text.secondary">{report.category}</Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>{report.generatedBy}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {new Date(report.createdAt).toLocaleString()}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            {statusDisplay.icon}
                            <Chip label={statusDisplay.label} color={statusDisplay.color} size="small" />
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                            {report.status === 'completed' && (
                              <IconButton size="small" onClick={() => downloadReport(report)}>
                                <Download />
                              </IconButton>
                            )}
                            <IconButton size="small">
                              <Visibility />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
              </Box>
            ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Report Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Generated By</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {generatedReports
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map(report => {
                      const statusDisplay = getStatusDisplay(report.status);
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {report.templateName}
                            </Typography>
                            {report.error && (
                              <Typography variant="caption" color="error">
                                Error: {report.error}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={report.category} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{report.generatedBy}</TableCell>
                          <TableCell>
                            {new Date(report.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {statusDisplay.icon}
                              <Chip 
                                label={statusDisplay.label} 
                                color={statusDisplay.color}
                                size="small" 
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            {report.fileSize ? `${report.fileSize} MB` : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {report.status === 'completed' && (
                                <>
                                  <Tooltip title="Download Report">
                                    <IconButton
                                      size="small"
                                      onClick={() => downloadReport(report)}
                                    >
                                      <Download />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Share Report">
                                    <IconButton size="small">
                                      <Share />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              <Tooltip title="View Details">
                                <IconButton size="small">
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
            )}

            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={generatedReports.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Box>
        )}

        {/* Analytics Dashboard Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Reports Analytics & Insights
            </Typography>

            <Grid container spacing={3}>
              {/* Popular Categories */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Most Popular Report Categories
                  </Typography>
                  <List>
                    {reportAnalytics.popularCategories.map((category) => (
                      <ListItem key={category.category}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography>{category.category}</Typography>
                              <Typography fontWeight="medium">{category.count} reports</Typography>
                            </Box>
                          }
                          secondary={
                            <LinearProgress 
                              variant="determinate" 
                              value={(category.count / reportAnalytics.totalReports) * 100}
                              sx={{ mt: 1 }}
                            />
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>

              {/* Quick Stats */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Quick Statistics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Most Used Template"
                        secondary={reportAnalytics.mostUsedTemplate}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Average Generation Time"
                        secondary={`${reportAnalytics.averageGenerationTime} minutes`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Success Rate"
                        secondary={`${reportAnalytics.successRate}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Reports This Month"
                        secondary={`${reportAnalytics.reportsThisMonth} of ${reportAnalytics.totalReports} total`}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>

              {/* Usage Trends Chart Placeholder */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Report Generation Trends
                  </Typography>
                  <Box sx={{ 
                    height: 300, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                    borderRadius: 2
                  }}>
                    <Typography color="text.secondary">
                      📈 Chart visualization would be implemented here with actual data
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Generate Report Dialog */}
      <Dialog 
        open={generateDialogOpen} 
        onClose={() => setGenerateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Generate Report: {selectedTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedTemplate.description}
              </Typography>
              
              <Alert severity="info" sx={{ my: 2 }}>
                <AlertTitle>Report Information</AlertTitle>
                Estimated generation time: {selectedTemplate.estimatedTime}<br />
                Complexity: {selectedTemplate.complexity}<br />
                Output format: PDF
              </Alert>

              {selectedTemplate.parameters.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    Report Parameters
                  </Typography>
                  {selectedTemplate.parameters.map(renderParameterInput)}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={submitReportGeneration}
            startIcon={<Assessment />}
          >
            Generate Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default Reports;