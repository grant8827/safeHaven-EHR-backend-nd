const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

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

  const where = {};

  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
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
          appointmentDate: true,
          appointmentType: true,
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

  const invoice = await prisma.invoice.create({
    data: {
      patientId,
      appointmentId,
      createdById: req.user.id,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      date: date ? new Date(date) : (invoiceDate ? new Date(invoiceDate) : new Date()),
      dueDate: dueDate ? new Date(dueDate) : null,
      subtotal: subtotal ? parseFloat(subtotal) : 0,
      tax: tax ? parseFloat(tax) : 0,
      total: parseFloat(total),
      status: status || 'draft',
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

  return res.status(201).json(invoice);
});

// Update invoice
const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    status,
    amountPaid,
    paidDate,
    notes,
  } = req.body;

  const updateData = {};
  
  if (status) updateData.status = status;
  if (amountPaid !== undefined) updateData.amountPaid = parseFloat(amountPaid);
  if (paidDate) updateData.paidDate = new Date(paidDate);
  if (notes !== undefined) updateData.notes = notes;

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

  return res.json(invoice);
});

// Delete invoice
const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.invoice.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Add payment to invoice
const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, paymentDate } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'amount is required' });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const newAmountPaid = invoice.amountPaid + parseFloat(amount);
  const isPaid = newAmountPaid >= invoice.totalAmount;

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      amountPaid: newAmountPaid,
      status: isPaid ? 'paid' : 'partial',
      paidDate: isPaid ? (paymentDate ? new Date(paymentDate) : new Date()) : null,
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

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addPayment,
  getClaims,
  getClaim,
  createClaim,
  updateClaim,
  deleteClaim,
};
