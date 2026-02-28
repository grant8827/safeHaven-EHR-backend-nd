const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all documents (with filters)
const getDocuments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    patientId,
    category,
    search,
  } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  // Access control
  if (userRole === 'client') {
    // Clients can only see their own documents
    const patient = await prisma.patient.findUnique({
      where: { userId },
    });
    if (patient) {
      where.patientId = patient.id;
    }
  } else if (patientId) {
    where.patientId = patientId;
  }

  if (category) where.category = category;
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
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
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where }),
  ]);

  return res.json({
    results: documents,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single document
const getDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const document = await prisma.document.findUnique({
    where: { id },
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
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      shares: {
        include: {
          sharedWith: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          sharedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Access control
  if (userRole === 'client') {
    const patient = await prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient || document.patientId !== patient.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Log access
  await prisma.documentAccessLog.create({
    data: {
      documentId: id,
      userId,
      action: 'view',
    },
  });

  return res.json(document);
});

// Upload document
const uploadDocument = asyncHandler(async (req, res) => {
  const {
    patientId,
    fileName,
    fileUrl,
    fileSize,
    mimeType,
    category,
    description,
    isEncrypted,
  } = req.body;
  const userId = req.user.id;

  if (!patientId || !fileName || !fileUrl) {
    return res.status(400).json({ 
      error: 'patientId, fileName, and fileUrl are required' 
    });
  }

  const document = await prisma.document.create({
    data: {
      patientId,
      fileName,
      fileUrl,
      fileSize,
      mimeType,
      category: category || 'other',
      description,
      isEncrypted: isEncrypted || false,
      uploadedById: userId,
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
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Log upload
  await prisma.documentAccessLog.create({
    data: {
      documentId: document.id,
      userId,
      action: 'upload',
    },
  });

  return res.status(201).json(document);
});

// Update document
const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    fileName,
    category,
    description,
  } = req.body;

  const updateData = {};
  
  if (fileName) updateData.fileName = fileName;
  if (category) updateData.category = category;
  if (description !== undefined) updateData.description = description;

  const document = await prisma.document.update({
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
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json(document);
});

// Delete document
const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await prisma.document.delete({
    where: { id },
  });

  // Log deletion
  await prisma.documentAccessLog.create({
    data: {
      documentId: id,
      userId,
      action: 'delete',
    },
  });

  return res.status(204).send();
});

// Share document
const shareDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sharedWithId, expiresAt } = req.body;
  const userId = req.user.id;

  if (!sharedWithId) {
    return res.status(400).json({ error: 'sharedWithId is required' });
  }

  const share = await prisma.documentShare.create({
    data: {
      documentId: id,
      sharedWithId,
      sharedById: userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      sharedWith: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  // Log share
  await prisma.documentAccessLog.create({
    data: {
      documentId: id,
      userId,
      action: 'share',
    },
  });

  return res.status(201).json(share);
});

// Revoke document share
const revokeShare = asyncHandler(async (req, res) => {
  const { id, shareId } = req.params;

  await prisma.documentShare.delete({
    where: { id: shareId },
  });

  return res.status(204).send();
});

// Get document access logs
const getAccessLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [logs, total] = await Promise.all([
    prisma.documentAccessLog.findMany({
      where: { documentId: id },
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.documentAccessLog.count({ where: { documentId: id } }),
  ]);

  return res.json({
    results: logs,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

module.exports = {
  getDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  revokeShare,
  getAccessLogs,
};
