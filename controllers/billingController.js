const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { redisClient } = require('../utils/redis');
const paypal = require('../utils/paypal');

// Redis billing helpers – Hash keyed billing:patient:{id} for sub-100ms HGETALL reads
const billingHelpers = {
  cacheInvoice: async (patientId, invoice) => {
    if (!redisClient) return;
    try { await redisClient.hset(`billing:patient:${patientId}`, invoice.id, JSON.stringify(invoice)); }
    catch (e) { console.error('[billing:cache] set error:', e.message); }
  },
  getPatientInvoices: async (patientId) => {
    if (!redisClient) return null;
    try {
      const hash = await redisClient.hgetall(`billing:patient:${patientId}`);
      if (!hash || Object.keys(hash).length === 0) return null;
      return Object.values(hash).map(v => JSON.parse(v));
    } catch (e) { return null; }
  },
  removeInvoice: async (patientId, invoiceId) => {
    if (!redisClient) return;
    try { await redisClient.hdel(`billing:patient:${patientId}`, invoiceId); } catch (e) {}
  },
  publishNewInvoice: async (patientId, invoiceId, total) => {
    if (!redisClient) return;
    try {
      await redisClient.publish('billing:new-invoice', JSON.stringify({ patientId, invoiceId, total, ts: Date.now() }));
    } catch (e) {}
  },
};

// Get all invoices (with filters)
const getInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    patientId,
    status,
    startDate,
    endDate,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const userId = req.user.id;
  const userRole = req.user.role;

  const where = {};

  if (userRole === 'client') {
    // Clients may only see their own invoices; look up the Patient record
    const patientRecord = await prisma.patient.findFirst({ where: { userId } });
    if (!patientRecord) return res.json({ results: [], count: 0, next: null, previous: null });

    // Redis fast-path – HGETALL billing:patient:{id} – sub-100ms
    const cached = await billingHelpers.getPatientInvoices(patientRecord.id);
    if (cached) {
      return res.json({ results: cached, count: cached.length, next: null, previous: null });
    }
    where.patientId = patientRecord.id;
  } else {
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        appointment: {
          select: {
            id: true,
            startTime: true,
            type: true,
          },
        },
        items: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);

  // Warm Redis cache on DB-hit for client requests
  if (userRole === 'client' && invoices.length > 0) {
    for (const inv of invoices) void billingHelpers.cacheInvoice(inv.patientId, inv);
  }

  return res.json({
    results: invoices,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single invoice
const getInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      appointment: {
        select: {
          id: true,
          startTime: true,
          type: true,
          therapist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      items: true,
      claim: true,
    },
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  return res.json(invoice);
});

// Create invoice
const createInvoice = asyncHandler(async (req, res) => {
  const {
    patientId,
    appointmentId,
    invoiceNumber,
    date,
    invoiceDate,  // Backwards compatibility
    dueDate,
    subtotal,
    tax,
    total,
    status,
    items,
    notes,
  } = req.body;

  if (!patientId || !total) {
    return res.status(400).json({ 
      error: 'patientId and total are required' 
    });
  }

  const VALID_STATUSES = ['draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
  const safeStatus = status && VALID_STATUSES.includes(status) ? status : 'pending';

  const invoice = await prisma.invoice.create({
    data: {
      patientId,
      appointmentId,
      createdById: req.user.id,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      date: date ? new Date(date) : (invoiceDate ? new Date(invoiceDate) : new Date()),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: subtotal ? parseFloat(subtotal) : 0,
      tax: tax ? parseFloat(tax) : 0,
      total: parseFloat(total),
      status: safeStatus,
      notes,
      items: items ? {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice),
          total: parseFloat(item.total || (item.quantity || 1) * parseFloat(item.unitPrice)),
          cptCode: item.cptCode,
        })),
      } : undefined,
    },
    include: {
      patient: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      items: true,
    },
  });

  // Write-through Redis cache + Pub/Sub notification for real-time patient view
  void billingHelpers.cacheInvoice(invoice.patientId, invoice);
  void billingHelpers.publishNewInvoice(invoice.patientId, invoice.id, invoice.total);

  return res.status(201).json(invoice);
});

// Update invoice
const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    patientId,
    status,
    total,
    subtotal,
    tax,
    date,
    dueDate,
    notes,
    paymentDate,
    paymentMethod,
  } = req.body;

  const VALID_STATUSES = ['draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
  const updateData = {};

  if (patientId !== undefined) updateData.patientId = patientId;
  if (status && VALID_STATUSES.includes(status)) updateData.status = status;
  if (total !== undefined) updateData.total = parseFloat(total);
  if (subtotal !== undefined) updateData.subtotal = parseFloat(subtotal);
  if (tax !== undefined) updateData.tax = parseFloat(tax);
  if (date) updateData.date = new Date(date);
  if (dueDate) updateData.dueDate = new Date(dueDate);
  if (notes !== undefined) updateData.notes = notes;
  if (paymentDate) updateData.paymentDate = new Date(paymentDate);
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: {
      patient: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      items: true,
    },
  });

  // Update Redis cache after write
  void billingHelpers.cacheInvoice(invoice.patientId, invoice);

  return res.json(invoice);
});

// Delete invoice
const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.invoice.findUnique({ where: { id }, select: { patientId: true } });

  await prisma.invoice.delete({
    where: { id },
  });

  if (existing) void billingHelpers.removeInvoice(existing.patientId, id);

  return res.status(204).send();
});

// Add payment to invoice
const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, paymentMethod } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'amount is required' });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Client can only pay their own invoice
  if (req.user.role === 'client') {
    const patientRecord = await prisma.patient.findFirst({ where: { userId: req.user.id } });
    if (!patientRecord || patientRecord.id !== invoice.patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const isPaid = parseFloat(amount) >= invoice.total;

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      status: isPaid ? 'paid' : 'partial',
      paymentDate: isPaid ? new Date() : (invoice.paymentDate ?? undefined),
      paymentMethod: paymentMethod || invoice.paymentMethod || undefined,
    },
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      items: true,
    },
  });

  // Update Redis cache
  void billingHelpers.cacheInvoice(updatedInvoice.patientId, updatedInvoice);

  return res.json(updatedInvoice);
});

// Get all claims
const getClaims = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    patientId,
    status,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (patientId) {
    where.invoice = {
      patientId,
    };
  }
  if (status) where.status = status;

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      skip,
      take,
      include: {
        invoice: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { submittedDate: 'desc' },
    }),
    prisma.claim.count({ where }),
  ]);

  return res.json({
    results: claims,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single claim
const getClaim = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          items: true,
        },
      },
    },
  });

  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  return res.json(claim);
});

// Create claim
const createClaim = asyncHandler(async (req, res) => {
  const {
    invoiceId,
    claimNumber,
    insurancePayer,
    submittedDate,
    claimedAmount,
    diagnosisCodes,
    notes,
  } = req.body;

  if (!invoiceId || !insurancePayer || !claimedAmount) {
    return res.status(400).json({ 
      error: 'invoiceId, insurancePayer, and claimedAmount are required' 
    });
  }

  const claim = await prisma.claim.create({
    data: {
      invoiceId,
      claimNumber,
      insurancePayer,
      submittedDate: submittedDate ? new Date(submittedDate) : new Date(),
      claimedAmount: parseFloat(claimedAmount),
      status: 'submitted',
      diagnosisCodes,
      notes,
    },
    include: {
      invoice: {
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return res.status(201).json(claim);
});

// Update claim
const updateClaim = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    status,
    approvedAmount,
    paidDate,
    denialReason,
    notes,
  } = req.body;

  const updateData = {};
  
  if (status) updateData.status = status;
  if (approvedAmount !== undefined) updateData.approvedAmount = parseFloat(approvedAmount);
  if (paidDate) updateData.paidDate = new Date(paidDate);
  if (denialReason !== undefined) updateData.denialReason = denialReason;
  if (notes !== undefined) updateData.notes = notes;

  const claim = await prisma.claim.update({
    where: { id },
    data: updateData,
    include: {
      invoice: {
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return res.json(claim);
});

// Delete claim
const deleteClaim = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.claim.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Get billing summary (totals by status) – used by both admin and patient dashboards
const getBillingSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const where = {};

  if (userRole === 'client') {
    const patientRecord = await prisma.patient.findFirst({ where: { userId } });
    if (!patientRecord) {
      return res.json({ totalBilled: 0, invoiceCount: 0, totalPaid: 0, paidCount: 0, totalOutstanding: 0, pendingCount: 0, totalOverdue: 0, overdueCount: 0 });
    }
    where.patientId = patientRecord.id;
  }

  const now = new Date();
  const [all, paid, pending, overdue] = await Promise.all([
    prisma.invoice.aggregate({ where, _sum: { total: true }, _count: { id: true } }),
    prisma.invoice.aggregate({ where: { ...where, status: 'paid' }, _sum: { total: true }, _count: { id: true } }),
    prisma.invoice.aggregate({ where: { ...where, status: { in: ['draft', 'pending', 'partial'] } }, _sum: { total: true }, _count: { id: true } }),
    prisma.invoice.aggregate({ where: { ...where, status: { notIn: ['paid', 'cancelled'] }, dueDate: { lt: now } }, _sum: { total: true }, _count: { id: true } }),
  ]);

  return res.json({
    totalBilled: all._sum.total ?? 0,
    invoiceCount: all._count.id ?? 0,
    totalPaid: paid._sum.total ?? 0,
    paidCount: paid._count.id ?? 0,
    totalOutstanding: pending._sum.total ?? 0,
    pendingCount: pending._count.id ?? 0,
    totalOverdue: overdue._sum.total ?? 0,
    overdueCount: overdue._count.id ?? 0,
  });
});

/**
 * POST /api/billing/invoices/:id/verify-paypal-payment
 *
 * Verifies a PayPal order with PayPal's REST API before recording the payment.
 * This prevents clients from faking a successful payment on the frontend.
 *
 * Body: { orderId: string, amount: number|string, paymentMethod: string }
 */
const verifyPayPalPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orderId, amount, paymentMethod } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }
  if (!amount) {
    return res.status(400).json({ error: 'amount is required' });
  }

  // Fetch the invoice to validate access and get the expected total
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Clients can only pay their own invoice
  if (req.user.role === 'client') {
    const patientRecord = await prisma.patient.findFirst({ where: { userId: req.user.id } });
    if (!patientRecord || patientRecord.id !== invoice.patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // ── Verify with PayPal ──────────────────────────────────────────────────────
  try {
    await paypal.verifyOrder(orderId, amount);
  } catch (verifyError) {
    console.error('[billing:paypal] Verification failed:', verifyError.message);
    return res.status(402).json({ error: verifyError.message });
  }

  // ── Record the payment now that PayPal confirmed it ─────────────────────────
  const isPaid = parseFloat(amount) >= invoice.total;

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      status: isPaid ? 'paid' : 'partial',
      paymentDate: isPaid ? new Date() : (invoice.paymentDate ?? undefined),
      paymentMethod: paymentMethod || 'paypal',
      transactionId: orderId,
    },
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      items: true,
    },
  });

  void billingHelpers.cacheInvoice(updatedInvoice.patientId, updatedInvoice);

  return res.json(updatedInvoice);
});

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addPayment,
  verifyPayPalPayment,
  getBillingSummary,
  getClaims,
  getClaim,
  createClaim,
  updateClaim,
  deleteClaim,
};
