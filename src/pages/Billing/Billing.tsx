import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
  ListItemIcon,
  Divider,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  Badge,
  Snackbar,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Avatar,
  TablePagination,
} from '@mui/material';
import {
  AttachMoney,
  Receipt,
  TrendingUp,
  Add,
  Edit,
  Delete,
  Visibility,
  Print,
  Email,
  Download,
  Search,
  FilterList,
  MoreVert,
  CreditCard,
  AccountBalance,
  Schedule,
  CheckCircle,
  Cancel,
  Assessment,
  LocalHospital,
  PaymentOutlined,
  MonetizationOn,
  PendingActions,
  ErrorOutline,
  ExpandMore,
  InsertDriveFile,
  CloudUpload,
  History,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '../../contexts/AuthContext';

// Billing interfaces
interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  serviceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  services: BillingService[];
  insuranceClaim?: InsuranceClaim;
  paymentHistory: Payment[];
  createdAt: string;
  updatedAt: string;
}

interface BillingService {
  id: string;
  cptCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  therapistId: string;
  therapistName: string;
}

interface InsuranceClaim {
  id: string;
  insuranceProvider: string;
  policyNumber: string;
  groupNumber?: string;
  status: 'pending' | 'submitted' | 'approved' | 'denied' | 'partial';
  submittedAmount: number;
  approvedAmount?: number;
  submittedDate?: string;
  responseDate?: string;
  denialReason?: string;
}

interface Payment {
  id: string;
  amount: number;
  method: 'cash' | 'check' | 'credit_card' | 'insurance' | 'bank_transfer';
  reference?: string;
  date: string;
  notes?: string;
}

interface BillingFormData {
  patientId: string;
  serviceDate: Date | null;
  services: BillingService[];
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  notes: string;
}

const cptCodes = [
  { code: '90834', description: 'Psychotherapy 45 minutes', price: 150 },
  { code: '90837', description: 'Psychotherapy 60 minutes', price: 200 },
  { code: '90791', description: 'Initial psychiatric evaluation', price: 250 },
  { code: '90834', description: 'Family psychotherapy with patient', price: 175 },
  { code: '96116', description: 'Neurobehavioral status exam', price: 300 },
];

const Billing: React.FC = () => {
  const { state } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingStats] = useState({
    monthlyRevenue: 0,
    totalOutstanding: 0,
    averageCollectionTime: 0,
    claimsApprovalRate: 0,
    pendingClaims: 0,
    completedClaims: 0,
    overdueClaims: 0,
    patientSatisfactionScore: 0,
  });
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: null
  });
  
  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceMenuAnchor, setInvoiceMenuAnchor] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form data
  const [formData, setFormData] = useState<BillingFormData>({
    patientId: '',
    serviceDate: new Date(),
    services: [],
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'credit_card' as Payment['method'],
    reference: '',
    notes: '',
  });

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    // For patients/clients, only show their own invoices
    const isPatient = state.user?.role === 'client';
    const matchesPatient = !isPatient || invoice.patientId === state.user?.id;

    const matchesSearch = !searchQuery || 
      invoice.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;

    return matchesPatient && matchesSearch && matchesStatus;
  });

  // Get status color
  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partially_paid': return 'info';
      case 'sent': return 'primary';
      case 'draft': return 'default';
      case 'overdue': return 'error';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method: Payment['method']) => {
    switch (method) {
      case 'credit_card': return <CreditCard />;
      case 'bank_transfer': return <AccountBalance />;
      case 'insurance': return <LocalHospital />;
      case 'cash': return <AttachMoney />;
      case 'check': return <Receipt />;
      default: return <PaymentOutlined />;
    }
  };

  // Handle invoice actions
  const handleCreateInvoice = () => {
    setFormData({
      patientId: '',
      serviceDate: new Date(),
      services: [],
      notes: '',
    });
    setInvoiceDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      patientId: invoice.patientId,
      serviceDate: new Date(invoice.serviceDate),
      services: invoice.services,
      notes: '',
    });
    setInvoiceDialogOpen(true);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.amount - invoice.paidAmount,
      method: 'credit_card',
      reference: '',
      notes: '',
    });
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = () => {
    if (!selectedInvoice) return;

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      amount: paymentData.amount,
      method: paymentData.method,
      reference: paymentData.reference,
      date: new Date().toISOString(),
      notes: paymentData.notes,
    };

    const updatedInvoice = {
      ...selectedInvoice,
      paidAmount: selectedInvoice.paidAmount + paymentData.amount,
      paymentHistory: [...selectedInvoice.paymentHistory, newPayment],
      status: (selectedInvoice.paidAmount + paymentData.amount >= selectedInvoice.amount) 
        ? 'paid' as const 
        : 'partially_paid' as const,
    };

    setInvoices(prev => prev.map(inv => 
      inv.id === selectedInvoice.id ? updatedInvoice : inv
    ));

    setPaymentDialogOpen(false);
    setSnackbarMessage('Payment recorded successfully!');
    setSnackbarOpen(true);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: Invoice) => {
    setInvoiceMenuAnchor(event.currentTarget);
    setSelectedInvoice(invoice);
  };

  const handleMenuClose = () => {
    setInvoiceMenuAnchor(null);
    setSelectedInvoice(null);
  };

  // Add service to invoice
  const addService = () => {
    const newService: BillingService = {
      id: `svc-${Date.now()}`,
      cptCode: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      therapistId: state.user?.id || '',
      therapistName: `${state.user?.firstName} ${state.user?.lastName}` || '',
    };

    setFormData(prev => ({
      ...prev,
      services: [...prev.services, newService]
    }));
  };

  const updateService = (index: number, field: keyof BillingService, value: any) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.map((service, i) => {
        if (i === index) {
          const updatedService = { ...service, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedService.total = updatedService.quantity * updatedService.unitPrice;
          }
          return updatedService;
        }
        return service;
      })
    }));
  };

  const isPatient = state.user?.role === 'client';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {isPatient ? 'My Billing' : 'Billing & Revenue Management'}
        </Typography>
        {!isPatient && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Assessment />}>
              Generate Report
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleCreateInvoice}>
              Create Invoice
            </Button>
          </Box>
        )}
      </Box>

      {/* Patient Info Banner */}
      {isPatient && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
          <Typography variant="body2">
            <strong>Your Billing Information:</strong> View your invoices, insurance claims, and payment history. 
            If you have questions about your bill, please contact your therapist or our billing department.
          </Typography>
        </Paper>
      )}

      {/* Financial Dashboard - Admin/Therapist Only */}
      {!isPatient && (
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <MonetizationOn color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                ${billingStats.monthlyRevenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monthly Revenue
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                <TrendingUp fontSize="small" color="success" />
                <Typography variant="caption" color="success.main" sx={{ ml: 0.5 }}>
                  +12% vs last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PendingActions color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                ${billingStats.totalOutstanding.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Outstanding Balance
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Avg collection: {billingStats.averageCollectionTime} days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <LocalHospital color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {billingStats.claimsApprovalRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Claims Approval Rate
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {billingStats.pendingClaims} pending claims
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Assessment color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="primary.main">
                {billingStats.patientSatisfactionScore}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Patient Satisfaction
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Based on billing experience
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Quick Stats Cards - Admin/Therapist Only */}
      {!isPatient && (
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Revenue Trends (Last 6 Months)
            </Typography>
            <Box sx={{ 
              height: 200, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: 2
            }}>
              <Typography color="text.secondary">
                📊 Revenue chart visualization would be implemented here
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Current Month: ${billingStats.monthlyRevenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="success.main">
                +12% Growth
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Claims Status Overview
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle color="success" fontSize="small" />
                      Approved Claims
                    </Box>
                  }
                  secondary={`${billingStats.completedClaims} claims - $${(billingStats.monthlyRevenue * 0.7).toLocaleString()}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule color="warning" fontSize="small" />
                      Pending Claims
                    </Box>
                  }
                  secondary={`${billingStats.pendingClaims} claims - $${(billingStats.totalOutstanding * 0.6).toLocaleString()}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ErrorOutline color="error" fontSize="small" />
                      Denied Claims
                    </Box>
                  }
                  secondary={`${billingStats.overdueClaims} claims - $${(billingStats.totalOutstanding * 0.2).toLocaleString()}`}
                />
              </ListItem>
            </List>
            <Button variant="outlined" fullWidth sx={{ mt: 2 }}>
              View All Claims
            </Button>
          </Paper>
        </Grid>
      </Grid>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search invoices, patients..."
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
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={filterStatus}
                label="Status Filter"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="partially_paid">Partially Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <DatePicker
              label="Start Date"
              value={selectedDateRange.start}
              onChange={(date) => setSelectedDateRange(prev => ({ ...prev, start: date }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<FilterList />}
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setSelectedDateRange({ start: null, end: null });
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content Tabs */}
      <Paper>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={filteredInvoices.length} color="primary">
                Invoices
              </Badge>
            }
            icon={<Receipt />}
            iconPosition="start"
          />
          <Tab 
            label={
              <Badge badgeContent={billingStats.pendingClaims} color="warning">
                Insurance Claims
              </Badge>
            }
            icon={<LocalHospital />}
            iconPosition="start"
          />
          <Tab 
            label="Payment History"
            icon={<History />}
            iconPosition="start"
          />
          {/* Reports Tab - Admin/Therapist Only */}
          {!isPatient && (
            <Tab 
              label="Reports"
              icon={<Assessment />}
              iconPosition="start"
            />
          )}
        </Tabs>

        {/* Invoices Tab */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice ID</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Service Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Paid</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {invoice.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {invoice.patientName.charAt(0)}
                          </Avatar>
                          {invoice.patientName}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.serviceDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell>${invoice.paidAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Typography 
                          color={(invoice.amount - invoice.paidAmount) > 0 ? 'error' : 'success'}
                          fontWeight="medium"
                        >
                          ${(invoice.amount - invoice.paidAmount).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status.replace('_', ' ').toUpperCase()}
                          color={getStatusColor(invoice.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small"
                          onClick={(e) => handleMenuOpen(e, invoice)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredInvoices.length}
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

        {/* Insurance Claims Tab */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>Insurance Claims Management</AlertTitle>
              Track and manage insurance claim submissions, approvals, and denials. 
              Automated claim processing and real-time status updates.
            </Alert>

            <Grid container spacing={3}>
              {invoices
                .filter(invoice => invoice.insuranceClaim)
                .map((invoice) => (
                <Grid item xs={12} md={6} key={invoice.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6">{invoice.id}</Typography>
                          <Typography color="text.secondary">
                            {invoice.patientName}
                          </Typography>
                        </Box>
                        <Chip
                          label={invoice.insuranceClaim?.status}
                          color={invoice.insuranceClaim?.status === 'approved' ? 'success' : 
                                 invoice.insuranceClaim?.status === 'denied' ? 'error' : 'warning'}
                          size="small"
                        />
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Insurance Provider
                          </Typography>
                          <Typography variant="body1">
                            {invoice.insuranceClaim?.insuranceProvider}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Submitted Amount
                          </Typography>
                          <Typography variant="body1">
                            ${invoice.insuranceClaim?.submittedAmount.toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Policy Number
                          </Typography>
                          <Typography variant="body1">
                            {invoice.insuranceClaim?.policyNumber}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Submitted Date
                          </Typography>
                          <Typography variant="body1">
                            {invoice.insuranceClaim?.submittedDate ? 
                             new Date(invoice.insuranceClaim.submittedDate).toLocaleDateString() : 
                             'Not submitted'}
                          </Typography>
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" startIcon={<Visibility />}>
                          View Details
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload />}>
                          Resubmit
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Payment History Tab */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Payment Transactions
            </Typography>
            
            <List>
              {invoices
                .flatMap(invoice => 
                  invoice.paymentHistory.map(payment => ({
                    ...payment,
                    invoiceId: invoice.id,
                    patientName: invoice.patientName
                  }))
                )
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((payment) => (
                <ListItem key={`${payment.invoiceId}-${payment.id}`} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPaymentMethodIcon(payment.method)}
                        <Typography variant="body1" fontWeight="medium">
                          ${payment.amount.toFixed(2)} - {payment.patientName}
                        </Typography>
                        <Chip 
                          label={payment.method.replace('_', ' ').toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Invoice: {payment.invoiceId} • {new Date(payment.date).toLocaleDateString()}
                        </Typography>
                        {payment.reference && (
                          <Typography variant="caption" color="text.secondary">
                            Ref: {payment.reference}
                          </Typography>
                        )}
                        {payment.notes && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {payment.notes}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Reports Tab - Admin/Therapist Only */}
        {!isPatient && tabValue === 3 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Financial Reports & Analytics
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Revenue Reports
                    </Typography>
                    <List>
                      <ListItem button>
                        <ListItemIcon><InsertDriveFile /></ListItemIcon>
                        <ListItemText 
                          primary="Monthly Revenue Summary"
                          secondary="Comprehensive revenue breakdown by service"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                      <ListItem button>
                        <ListItemIcon><Assessment /></ListItemIcon>
                        <ListItemText 
                          primary="Therapist Performance Report"
                          secondary="Individual therapist revenue and productivity"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                      <ListItem button>
                        <ListItemIcon><TrendingUp /></ListItemIcon>
                        <ListItemText 
                          primary="Year-over-Year Analysis"
                          secondary="Annual growth and trend analysis"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Insurance & Claims Reports
                    </Typography>
                    <List>
                      <ListItem button>
                        <ListItemIcon><LocalHospital /></ListItemIcon>
                        <ListItemText 
                          primary="Claims Approval Analysis"
                          secondary="Approval rates by insurance provider"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                      <ListItem button>
                        <ListItemIcon><Schedule /></ListItemIcon>
                        <ListItemText 
                          primary="Pending Claims Report"
                          secondary="Outstanding claims requiring attention"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                      <ListItem button>
                        <ListItemIcon><ErrorOutline /></ListItemIcon>
                        <ListItemText 
                          primary="Denial Analysis"
                          secondary="Common denial reasons and trends"
                        />
                        <IconButton><Download /></IconButton>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Invoice Actions Menu */}
      <Menu
        anchorEl={invoiceMenuAnchor}
        open={Boolean(invoiceMenuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedInvoice && handleEditInvoice(selectedInvoice)}>
          <ListItemIcon><Edit /></ListItemIcon>
          Edit Invoice
        </MenuItem>
        <MenuItem onClick={() => selectedInvoice && handleRecordPayment(selectedInvoice)}>
          <ListItemIcon><PaymentOutlined /></ListItemIcon>
          Record Payment
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><Print /></ListItemIcon>
          Print Invoice
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><Email /></ListItemIcon>
          Send Email
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><Cancel /></ListItemIcon>
          Cancel Invoice
        </MenuItem>
      </Menu>

      {/* Create/Edit Invoice Dialog */}
      <Dialog 
        open={invoiceDialogOpen} 
        onClose={() => setInvoiceDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedInvoice ? 'Edit Invoice' : 'Create New Invoice'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Patient</InputLabel>
                <Select
                  value={formData.patientId}
                  label="Patient"
                  onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
                >
                  {/* TODO: Load patients from API */}
                  <MenuItem value="">
                    <em>Select a patient</em>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <DatePicker
                label="Service Date"
                value={formData.serviceDate}
                onChange={(date) => setFormData(prev => ({ ...prev, serviceDate: date }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Services & Procedures
              </Typography>
              
              {formData.services.map((service, index) => (
                <Accordion key={service.id} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>
                      {service.cptCode || 'New Service'} - ${service.total.toFixed(2)}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>CPT Code</InputLabel>
                          <Select
                            value={service.cptCode}
                            label="CPT Code"
                            onChange={(e) => {
                              const selectedCode = cptCodes.find(code => code.code === e.target.value);
                              if (selectedCode) {
                                updateService(index, 'cptCode', selectedCode.code);
                                updateService(index, 'description', selectedCode.description);
                                updateService(index, 'unitPrice', selectedCode.price);
                              }
                            }}
                          >
                            {cptCodes.map((code) => (
                              <MenuItem key={code.code} value={code.code}>
                                {code.code} - {code.description}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={service.description}
                          onChange={(e) => updateService(index, 'description', e.target.value)}
                        />
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <TextField
                          fullWidth
                          label="Quantity"
                          type="number"
                          value={service.quantity}
                          onChange={(e) => updateService(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <TextField
                          fullWidth
                          label="Unit Price"
                          type="number"
                          value={service.unitPrice}
                          onChange={(e) => updateService(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} md={1}>
                        <IconButton 
                          color="error"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            services: prev.services.filter((_, i) => i !== index)
                          }))}
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}

              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={addService}
                sx={{ mt: 2 }}
              >
                Add Service
              </Button>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">
            {selectedInvoice ? 'Update' : 'Create'} Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Recording Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Recording payment for Invoice {selectedInvoice.id} - {selectedInvoice.patientName}
                <br />
                <strong>Outstanding Balance: ${(selectedInvoice.amount - selectedInvoice.paidAmount).toFixed(2)}</strong>
              </Alert>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Payment Amount"
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={paymentData.method}
                      label="Payment Method"
                      onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value as Payment['method'] }))}
                    >
                      <MenuItem value="credit_card">Credit Card</MenuItem>
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="check">Check</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="insurance">Insurance Payment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Reference Number"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Transaction ID, Check #, etc."
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Payment Notes"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSubmitPayment}
            disabled={!paymentData.amount || paymentData.amount <= 0}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default Billing;