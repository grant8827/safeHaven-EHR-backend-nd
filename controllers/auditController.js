const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// Create audit log (batch)
const createAuditLogs = asyncHandler(async (req, res) => {
  const { logs } = req.body;

  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs array is required' });
  }

  const auditLogs = await prisma.auditLog.createMany({
    data: logs.map((log) => ({
      userId: log.userId || req.user?.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValues: log.oldValues || null,
      newValues: log.newValues || null,
      ipAddress: log.ipAddress || req.ip,
      userAgent: log.userAgent || req.get('user-agent'),
    })),
  });

  return res.status(201).json({ 
    message: `${auditLogs.count} audit logs created`,
    count: auditLogs.count,
  });
});

// Get audit logs (with filters)
const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    userId,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({
    results: logs,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single audit log
const getAuditLog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
        },
      },
    },
  });

  if (!log) {
    return res.status(404).json({ error: 'Audit log not found' });
  }

  return res.json(log);
});

module.exports = {
  createAuditLogs,
  getAuditLogs,
  getAuditLog,
};
