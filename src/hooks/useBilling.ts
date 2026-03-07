/**
 * useBilling – unified hook for all billing operations.
 *
 * Wraps GET /billing/invoices, GET /billing/summary, and invoice mutation
 * actions with optimistic UI updates so the table reflects changes instantly
 * without waiting for the server round-trip.
 */
import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export interface Invoice {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  invoiceNumber: string;
  date: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'pending' | 'paid' | 'partial' | 'cancelled';
  paymentDate?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  totalBilled: number;
  invoiceCount: number;
  totalPaid: number;
  paidCount: number;
  totalOutstanding: number;
  pendingCount: number;
  totalOverdue: number;
  overdueCount: number;
}

export function useBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/billing/invoices', { params });
      setInvoices((res.data.results ?? res.data) || []);
    } catch (e) {
      console.error('[useBilling] fetchInvoices', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get('/billing/summary');
      setSummary(res.data as BillingSummary);
    } catch (e) {
      console.error('[useBilling] fetchSummary', e);
    }
  }, []);

  const createInvoice = useCallback(
    async (data: Partial<Invoice> & { total: number; patientId: string }) => {
      const res = await apiClient.post('/billing/invoices', data);
      const created = res.data as Invoice;
      setInvoices((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  /** Optimistic status update – reverts on server error */
  const updateInvoiceStatus = useCallback(
    async (id: string, patch: Partial<Invoice>) => {
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)));
      try {
        const res = await apiClient.patch(`/billing/invoices/${id}`, patch);
        const updated = res.data as Invoice;
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
        return updated;
      } catch (e) {
        // Revert
        fetchInvoices().catch(() => {});
        throw e;
      }
    },
    [fetchInvoices]
  );

  /** Optimistic payment – marks invoice paid locally, sends to server */
  const addPayment = useCallback(
    async (id: string, amount: number, paymentMethod?: string) => {
      const inv = invoices.find((i) => i.id === id);
      const isPaid = inv ? amount >= inv.total : true;
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: (isPaid ? 'paid' : 'partial') as Invoice['status'],
                paymentDate: isPaid ? new Date().toISOString() : i.paymentDate,
                paymentMethod: paymentMethod ?? i.paymentMethod,
              }
            : i
        )
      );
      try {
        const res = await apiClient.post(`/billing/invoices/${id}/payment`, {
          amount,
          paymentMethod,
        });
        const updated = res.data as Invoice;
        setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
        return updated;
      } catch (e) {
        fetchInvoices().catch(() => {});
        throw e;
      }
    },
    [invoices, fetchInvoices]
  );

  /** Optimistic delete */
  const deleteInvoice = useCallback(
    async (id: string) => {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      try {
        await apiClient.delete(`/billing/invoices/${id}`);
      } catch (e) {
        fetchInvoices().catch(() => {});
        throw e;
      }
    },
    [fetchInvoices]
  );

  return {
    invoices,
    summary,
    loading,
    fetchInvoices,
    fetchSummary,
    createInvoice,
    updateInvoiceStatus,
    addPayment,
    deleteInvoice,
    setInvoices,
  };
}
