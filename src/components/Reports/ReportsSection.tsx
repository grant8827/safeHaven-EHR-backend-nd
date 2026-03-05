import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
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
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  SelectChangeEvent,
} from '@mui/material';
import {
  Assessment as ReportsIcon,
  People as UsersIcon,
  Schedule as AppointmentsIcon,
  AttachMoney as RevenueIcon,
  Security as AuditIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  PersonAdd,
  Event,
  Payment,
} from '@mui/icons-material';
import { systemService } from '../../services/systemService';

interface ReportData {
  id: string;
  type: 'users' | 'patients' | 'appointments' | 'revenue' | 'audit';
  title: string;
  description: string;
  generated_at: string;
  status: 'generating' | 'ready' | 'failed';
  download_url?: string;
  expires_at?: string;
}

const ReportsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<string>('users');
  const [error, setError] = useState<string | null>(null);

  const reportTypes = [
    {
      id: 'users',
      title: 'User Activity Report',
      description: 'Comprehensive report of user registrations, logins, and activity patterns',
      icon: <UsersIcon />,
      color: 'primary',
    },
    {
      id: 'patients',
      title: 'Patient Demographics Report',
      description: 'Statistical analysis of patient demographics, appointments, and treatment outcomes',
      icon: <PersonAdd />,
      color: 'success',
    },
    {
      id: 'appointments',
      title: 'Appointment Analytics',
      description: 'Detailed breakdown of appointment scheduling, completion rates, and trends',
      icon: <AppointmentsIcon />,
      color: 'warning',
    },
    {
      id: 'revenue',
      title: 'Financial Report',
      description: 'Revenue analysis, billing summaries, and financial performance metrics',
      icon: <RevenueIcon />,
      color: 'success',
    },
    {
      id: 'audit',
      title: 'HIPAA Audit Trail',
      description: 'Comprehensive audit log for HIPAA compliance and security monitoring',
      icon: <AuditIcon />,
      color: 'error',
    },
  ];

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockReports: ReportData[] = [
        {
          id: '1',
          type: 'users',
          title: 'Monthly User Activity Report',
          description: 'October 2025 user activity summary',
          generated_at: new Date().toISOString(),
          status: 'ready',
          download_url: '/api/reports/users_202510.pdf',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          type: 'revenue',
          title: 'Q3 2025 Financial Report',
          description: 'Quarterly revenue and billing analysis',
          generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'ready',
          download_url: '/api/reports/revenue_q3_2025.pdf',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '3',
          type: 'audit',
          title: 'HIPAA Compliance Audit',
          description: 'Monthly HIPAA audit trail report',
          generated_at: new Date().toISOString(),
          status: 'generating',
        },
      ];
      setReports(mockReports);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await systemService.generateReport(selectedReportType as any);
      
      // Add new report to list
      const newReport: ReportData = {
        id: result.report_id,
        type: selectedReportType as any,
        title: `${reportTypes.find(t => t.id === selectedReportType)?.title} - ${new Date().toLocaleDateString()}`,
        description: `Generated on ${new Date().toLocaleString()}`,
        generated_at: new Date().toISOString(),
        status: 'generating',
      };

      setReports(prev => [newReport, ...prev]);

      // Simulate report generation completion
      setTimeout(() => {
        setReports(prev => prev.map(report => 
          report.id === newReport.id 
            ? { 
                ...report, 
                status: 'ready' as const, 
                download_url: result.download_url,
                expires_at: result.expires_at
              }
            : report
        ));
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (report: ReportData) => {
    if (report.download_url) {
      window.open(report.download_url, '_blank');
    }
  };

  const ReportGeneration = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Generate New Report
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={selectedReportType}
              label="Report Type"
              onChange={(e: SelectChangeEvent<string>) => setSelectedReportType(e.target.value)}
            >
              {reportTypes.map(type => (
                <MenuItem key={type.id} value={type.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {type.icon}
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="subtitle2">{type.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', gap: 2, height: '100%', alignItems: 'end' }}>
            <Button
              variant="contained"
              startIcon={<ReportsIcon />}
              onClick={generateReport}
              disabled={loading}
              size="large"
            >
              Generate Report
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadReports}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Report Type Cards */}
      <Grid container spacing={3}>
        {reportTypes.map(type => (
          <Grid item xs={12} sm={6} md={4} key={type.id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                border: selectedReportType === type.id ? 2 : 1,
                borderColor: selectedReportType === type.id ? `${type.color}.main` : 'divider'
              }}
              onClick={() => setSelectedReportType(type.id)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {React.cloneElement(type.icon, { 
                    color: type.color as any, 
                    fontSize: 'large' 
                  })}
                  <Typography variant="h6" sx={{ ml: 2 }}>
                    {type.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  {type.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const ReportHistory = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Report History
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Report</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Generated</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map(report => (
              <TableRow key={report.id}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2">
                      {report.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {report.description}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={report.type.toUpperCase()} 
                    size="small"
                    color={reportTypes.find(t => t.id === report.type)?.color as any}
                  />
                </TableCell>
                <TableCell>
                  {new Date(report.generated_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {report.status === 'generating' && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      <Typography variant="body2">Generating...</Typography>
                    </Box>
                  )}
                  {report.status === 'ready' && (
                    <Chip label="Ready" color="success" size="small" />
                  )}
                  {report.status === 'failed' && (
                    <Chip label="Failed" color="error" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  {report.status === 'ready' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadReport(report)}
                    >
                      Download
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {reports.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="textSecondary">
            No reports generated yet. Create your first report using the form above.
          </Typography>
        </Box>
      )}
    </Box>
  );

  const QuickStats = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <UsersIcon color="primary" />
              <Box sx={{ ml: 2 }}>
                <Typography variant="h6">45</Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Users
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Event color="success" />
              <Box sx={{ ml: 2 }}>
                <Typography variant="h6">23</Typography>
                <Typography variant="body2" color="textSecondary">
                  Today's Appointments
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Payment color="warning" />
              <Box sx={{ ml: 2 }}>
                <Typography variant="h6">$18.5K</Typography>
                <Typography variant="body2" color="textSecondary">
                  Monthly Revenue
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AuditIcon color="error" />
              <Box sx={{ ml: 2 }}>
                <Typography variant="h6">98.5%</Typography>
                <Typography variant="body2" color="textSecondary">
                  HIPAA Compliance
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const tabPanels = [
    { label: 'Generate', component: <ReportGeneration /> },
    { label: 'History', component: <ReportHistory /> },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Reports & Analytics
      </Typography>

      <QuickStats />

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_event: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
          >
            {tabPanels.map((panel, index) => (
              <Tab key={index} label={panel.label} />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {tabPanels[activeTab]?.component}
        </Box>
      </Paper>
    </Box>
  );
};

export default ReportsSection;