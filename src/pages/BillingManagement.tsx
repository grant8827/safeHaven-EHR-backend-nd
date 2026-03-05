import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  useTheme,
  useMediaQuery,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { apiClient } from '../services/apiClient';
import { useNotification } from '../contexts/NotificationContext';

interface Bill {
  id: number;
  patient: number;
  patient_name: string;
  title: string;
  description: string;
  amount: string;
  amount_paid: string;
  balance_remaining: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  payment_method: string;
  transaction_id: string;
  is_paid: boolean;
  is_overdue: boolean;
  created_at: string;
}

interface Patient {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface BillingFormData {
  patient: string;
  title: string;
  description: string;
  amount: string;
  issue_date: string;
  due_date: string;
}

interface PaymentFormData {
  amount: string;
  payment_method: string;
  transaction_id: string;
}

const BillingManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showSuccess, showError } = useNotification();
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  
  const [formData, setFormData] = useState<BillingFormData>({
    patient: '',
    title: '',
    description: '',
    amount: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
  });

  const [paymentData, setPaymentData] = useState<PaymentFormData>({
    amount: '',
    payment_method: '',
    transaction_id: '',
  });

  useEffect(() => {
    fetchBills();
    fetchPatients();
  }, []);

  const fetchBills = async () => {
    try {
      const response = await apiClient.get('/billing/bills/');
      setBills(response.data.results || response.data);
    } catch (error) {
      showError('Failed to load bills');
      console.error('Error fetching bills:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      console.log('Fetching users from /auth/ endpoint...');
      const response = await apiClient.get('/auth/');
      console.log('Users API response:', response);
      console.log('Response data:', response.data);
      
      const userList = response.data.results || response.data;
      console.log('User list (before filtering):', userList);
      console.log('Is array?', Array.isArray(userList));
      
      // Filter only active client users
      const activeClients = Array.isArray(userList) 
        ? userList.filter((u: Patient) => {
            console.log(`Checking user ${u.username}: role=${u.role}, is_active=${u.is_active}`);
            return u.role === 'client' && u.is_active === true;
          })
        : [];
      
      console.log('Active client users (after filtering):', activeClients);
      console.log('Number of active clients:', activeClients.length);
      setPatients(activeClients);
    } catch (error: any) {
      console.error('Error fetching client users:', error);
      console.error('Error details:', error.response?.data);
      showError('Failed to load patients: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleOpenDialog = (bill?: Bill) => {
    if (bill) {
      setEditMode(true);
      setSelectedBill(bill);
      setFormData({
        patient: bill.patient.toString(),
        title: bill.title,
        description: bill.description,
        amount: bill.amount,
        issue_date: bill.issue_date,
        due_date: bill.due_date,
      });
    } else {
      setEditMode(false);
      setSelectedBill(null);
      setFormData({
        patient: '',
        title: '',
        description: '',
        amount: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditMode(false);
    setSelectedBill(null);
  };

  const handleSubmit = async () => {
    try {
      if (editMode && selectedBill) {
        await apiClient.patch(`/billing/bills/${selectedBill.id}/`, formData);
        showSuccess('Bill updated successfully');
      } else {
        await apiClient.post('/billing/bills/', formData);
        showSuccess('Bill created successfully');
      }
      handleCloseDialog();
      fetchBills();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to save bill');
      console.error('Error saving bill:', error);
    }
  };

  const handleDelete = async (billId: number) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    
    try {
      await apiClient.delete(`/billing/bills/${billId}/`);
      showSuccess('Bill deleted successfully');
      fetchBills();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to delete bill');
      console.error('Error deleting bill:', error);
    }
  };

  const handleOpenPaymentDialog = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentData({
      amount: bill.balance_remaining,
      payment_method: '',
      transaction_id: '',
    });
    setOpenPaymentDialog(true);
  };

  const handleClosePaymentDialog = () => {
    setOpenPaymentDialog(false);
    setSelectedBill(null);
  };

  const handleAddPayment = async () => {
    if (!selectedBill) return;

    try {
      await apiClient.post(`/billing/bills/${selectedBill.id}/add_payment/`, paymentData);
      showSuccess('Payment recorded successfully');
      handleClosePaymentDialog();
      fetchBills();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to record payment');
      console.error('Error recording payment:', error);
    }
  };

  const getStatusColor = (status: string): ChipProps['color'] => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `$${parseFloat(amount.toString()).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5 }}>
        <Typography variant="h4">Billing Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          fullWidth={isMobile}
        >
          Create Bill
        </Button>
      </Box>

      {isMobile ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {bills.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="text.secondary" textAlign="center">No bills found</Typography>
              </CardContent>
            </Card>
          ) : (
            bills.map((bill) => (
              <Card key={bill.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle1">{bill.patient_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{bill.title}</Typography>
                    </Box>
                    <Chip label={bill.status.toUpperCase()} color={getStatusColor(bill.status)} size="small" />
                  </Box>

                  <Typography variant="body2"><strong>Amount:</strong> {formatCurrency(bill.amount)}</Typography>
                  <Typography variant="body2"><strong>Paid:</strong> {formatCurrency(bill.amount_paid)}</Typography>
                  <Typography variant="body2" color={parseFloat(bill.balance_remaining) > 0 ? 'error.main' : 'success.main'}>
                    <strong>Balance:</strong> {formatCurrency(bill.balance_remaining)}
                  </Typography>
                  <Typography variant="body2" color={bill.is_overdue ? 'error.main' : 'text.primary'}>
                    <strong>Due:</strong> {formatDate(bill.due_date)}
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <IconButton size="small" onClick={() => handleOpenDialog(bill)} title="Edit">
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenPaymentDialog(bill)}
                      title="Add Payment"
                      disabled={bill.status === 'paid' || bill.status === 'cancelled'}
                    >
                      <PaymentIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(bill.id)} title="Delete" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Paid</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="text.secondary">No bills found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    bills.map((bill) => (
                      <TableRow key={bill.id} hover>
                        <TableCell>{bill.patient_name}</TableCell>
                        <TableCell>{bill.title}</TableCell>
                        <TableCell>{formatCurrency(bill.amount)}</TableCell>
                        <TableCell>{formatCurrency(bill.amount_paid)}</TableCell>
                        <TableCell>
                          <Typography
                            color={parseFloat(bill.balance_remaining) > 0 ? 'error' : 'success'}
                            fontWeight="bold"
                          >
                            {formatCurrency(bill.balance_remaining)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={bill.status.toUpperCase()}
                            color={getStatusColor(bill.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography color={bill.is_overdue ? 'error' : 'inherit'}>
                            {formatDate(bill.due_date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(bill)}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenPaymentDialog(bill)}
                            title="Add Payment"
                            disabled={bill.status === 'paid' || bill.status === 'cancelled'}
                          >
                            <PaymentIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(bill.id)}
                            title="Delete"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Bill Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Bill' : 'Create New Bill'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Patient</InputLabel>
                  <Select
                    value={formData.patient}
                    onChange={(e) => setFormData({ ...formData, patient: e.target.value as string })}
                    label="Patient"
                  >
                    <MenuItem value="">Select a patient</MenuItem>
                    {patients.length === 0 ? (
                      <MenuItem disabled>No active patients found</MenuItem>
                    ) : (
                      patients.map((patient) => (
                        <MenuItem key={patient.id} value={patient.id}>
                          {patient.full_name || `${patient.first_name} ${patient.last_name}`} ({patient.email})
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Issue Date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.patient || !formData.title || !formData.amount || !formData.due_date}
          >
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={openPaymentDialog} onClose={handleClosePaymentDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Payment
          {selectedBill && (
            <Typography variant="subtitle2" color="text.secondary">
              Bill: {selectedBill.title} - Balance: {formatCurrency(selectedBill.balance_remaining)}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                    label="Payment Method"
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="credit_card">Credit Card</MenuItem>
                    <MenuItem value="debit_card">Debit Card</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                    <MenuItem value="check">Check</MenuItem>
                    <MenuItem value="insurance">Insurance</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Transaction ID (Optional)"
                  value={paymentData.transaction_id}
                  onChange={(e) => setPaymentData({ ...paymentData, transaction_id: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePaymentDialog}>Cancel</Button>
          <Button
            onClick={handleAddPayment}
            variant="contained"
            disabled={!paymentData.amount || !paymentData.payment_method}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingManagement;
