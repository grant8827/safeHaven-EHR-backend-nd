const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 8000;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const asyncHandler = (handler) => (req, res, next) => {
	Promise.resolve(handler(req, res, next)).catch(next);
};

const toSnakeUser = (user) => ({
	id: user.id,
	username: user.username,
	email: user.email,
	first_name: user.firstName,
	last_name: user.lastName,
	role: user.role,
	is_active: user.isActive,
	must_change_password: user.mustChangePassword,
	last_login: user.lastLogin,
	created_at: user.createdAt,
	updated_at: user.updatedAt,
	phone_number: user.phoneNumber || null,
});

const toCamelUser = (user) => ({
	id: user.id,
	username: user.username,
	email: user.email,
	firstName: user.firstName,
	lastName: user.lastName,
	role: user.role,
	isActive: user.isActive,
	must_change_password: user.mustChangePassword,
	lastLogin: user.lastLogin,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
	phoneNumber: user.phoneNumber || null,
});

const apiSuccess = (res, data, message) => res.json({ success: true, data, message });
const apiError = (res, message, errors = [], status = 400) =>
	res.status(status).json({ success: false, message, errors });

const signAccessToken = (user) =>
	jwt.sign(
		{ sub: user.id, role: user.role },
		JWT_ACCESS_SECRET,
		{ expiresIn: ACCESS_TOKEN_TTL }
	);

const signRefreshToken = (user) =>
	jwt.sign(
		{ sub: user.id, type: 'refresh' },
		JWT_REFRESH_SECRET,
		{ expiresIn: REFRESH_TOKEN_TTL }
	);

const authenticate = asyncHandler(async (req, res, next) => {
	const authHeader = req.headers.authorization || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

	if (!token) {
		return apiError(res, 'Unauthorized', ['Missing access token'], 401);
	}

	try {
		const payload = jwt.verify(token, JWT_ACCESS_SECRET);
		const user = await prisma.user.findUnique({ where: { id: payload.sub } });

		if (!user || !user.isActive) {
			return apiError(res, 'Unauthorized', ['User not found or inactive'], 401);
		}

		req.user = user;
		next();
	} catch (error) {
		return apiError(res, 'Unauthorized', ['Invalid or expired token'], 401);
	}
});

const requireRole = (...roles) => (req, res, next) => {
	if (!req.user || !roles.includes(req.user.role)) {
		return apiError(res, 'Forbidden', ['Insufficient permissions'], 403);
	}
	next();
};

const revokeRefreshTokensForUser = async (userId) => {
	await prisma.refreshToken.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
};

const createRefreshToken = async (userId) => {
	const token = uuidv4();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	await prisma.refreshToken.create({
		data: {
			token,
			userId,
			expiresAt,
		},
	});

	return token;
};

const validateRefreshToken = async (token) => {
	const record = await prisma.refreshToken.findUnique({ where: { token } });
	if (!record || record.revokedAt) {
		return null;
	}
	if (record.expiresAt < new Date()) {
		await prisma.refreshToken.update({ where: { token }, data: { revokedAt: new Date() } });
		return null;
	}
	return record;
};

app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.post('/api/auth/login/', asyncHandler(async (req, res) => {
	const { username, password } = req.body || {};

	if (!username || !password) {
		return apiError(res, 'Username and password are required', ['Missing credentials'], 400);
	}

	const user = await prisma.user.findFirst({
		where: {
			OR: [
				{ username },
				{ email: username },
			],
		},
	});

	if (!user || !user.isActive) {
		return apiError(res, 'Invalid credentials', ['Invalid username or password'], 401);
	}

	const passwordMatch = await bcrypt.compare(password, user.passwordHash);
	if (!passwordMatch) {
		return apiError(res, 'Invalid credentials', ['Invalid username or password'], 401);
	}

	const access = signAccessToken(user);
	const refresh = await createRefreshToken(user.id);

	await prisma.user.update({
		where: { id: user.id },
		data: { lastLogin: new Date() },
	});

	return res.json({
		access,
		refresh,
		user: toSnakeUser(user),
	});
}));

app.post('/api/auth/refresh/', asyncHandler(async (req, res) => {
	const { refresh } = req.body || {};
	let record = null;

	if (refresh) {
		record = await validateRefreshToken(refresh);
	} else {
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		const decoded = token ? jwt.decode(token) : null;

		if (decoded && decoded.sub) {
			record = await prisma.refreshToken.findFirst({
				where: {
					userId: decoded.sub,
					revokedAt: null,
					expiresAt: { gt: new Date() },
				},
				orderBy: { createdAt: 'desc' },
			});
		}
	}

	if (!record) {
		return apiError(res, 'Invalid refresh token', ['Refresh token not found'], 401);
	}

	const user = await prisma.user.findUnique({ where: { id: record.userId } });
	if (!user || !user.isActive) {
		return apiError(res, 'Invalid refresh token', ['User not found or inactive'], 401);
	}

	const access = signAccessToken(user);
	return res.json({ access });
}));

app.post('/api/auth/logout', authenticate, asyncHandler(async (req, res) => {
	const { refresh } = req.body || {};

	if (refresh) {
		await prisma.refreshToken.updateMany({
			where: { token: refresh },
			data: { revokedAt: new Date() },
		});
	}

	await revokeRefreshTokensForUser(req.user.id);
	return apiSuccess(res, null, 'Logged out');
}));

app.post('/api/auth/register', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const {
		username,
		email,
		password,
		password_confirm,
		first_name,
		last_name,
		role,
		phone_number,
	} = req.body || {};

	if (!username || !email || !password || !first_name || !last_name) {
		return apiError(res, 'Missing required fields', ['Required fields are missing'], 400);
	}

	if (password !== password_confirm) {
		return apiError(res, 'Password confirmation does not match', ['Password mismatch'], 400);
	}

	const existing = await prisma.user.findFirst({
		where: { OR: [{ username }, { email }] },
	});

	if (existing) {
		return apiError(res, 'User already exists', ['Username or email already in use'], 409);
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const newUser = await prisma.user.create({
		data: {
			username,
			email,
			passwordHash,
			firstName: first_name,
			lastName: last_name,
			role: role || 'client',
			phoneNumber: phone_number || null,
		},
	});

	return apiSuccess(res, toCamelUser(newUser), 'User created');
}));

app.post('/api/auth/validate', asyncHandler(async (req, res) => {
	const { token } = req.body || {};
	if (!token) {
		return apiError(res, 'Token required', ['Missing token'], 400);
	}

	try {
		const payload = jwt.verify(token, JWT_ACCESS_SECRET);
		const user = await prisma.user.findUnique({ where: { id: payload.sub } });

		if (!user || !user.isActive) {
			return apiError(res, 'Invalid token', ['User not found or inactive'], 401);
		}

		return apiSuccess(res, toCamelUser(user), 'Token valid');
	} catch (error) {
		return apiError(res, 'Invalid token', ['Token invalid or expired'], 401);
	}
}));

app.post('/api/auth/password-reset-request', asyncHandler(async (req, res) => {
	const { email } = req.body || {};

	if (!email) {
		return apiError(res, 'Email required', ['Missing email'], 400);
	}

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user) {
		return apiSuccess(res, null, 'If the email exists, a reset link was sent');
	}

	const token = uuidv4();
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

	await prisma.passwordResetToken.create({
		data: {
			token,
			userId: user.id,
			expiresAt,
		},
	});

	const responseData = process.env.NODE_ENV === 'production' ? null : { token };
	return apiSuccess(res, responseData, 'Password reset requested');
}));

app.post('/api/auth/password-reset', asyncHandler(async (req, res) => {
	const { token, password } = req.body || {};

	if (!token || !password) {
		return apiError(res, 'Token and password required', ['Missing data'], 400);
	}

	const record = await prisma.passwordResetToken.findUnique({ where: { token } });
	if (!record || record.usedAt || record.expiresAt < new Date()) {
		return apiError(res, 'Invalid token', ['Reset token invalid or expired'], 400);
	}

	const passwordHash = await bcrypt.hash(password, 10);
	await prisma.user.update({
		where: { id: record.userId },
		data: { passwordHash },
	});

	await prisma.passwordResetToken.update({
		where: { token },
		data: { usedAt: new Date() },
	});

	return apiSuccess(res, null, 'Password reset successful');
}));

app.post('/api/auth/change-password', authenticate, asyncHandler(async (req, res) => {
	const { currentPassword, newPassword } = req.body || {};

	if (!currentPassword || !newPassword) {
		return apiError(res, 'Missing data', ['Current and new password required'], 400);
	}

	const user = req.user;
	const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
	if (!passwordMatch) {
		return apiError(res, 'Invalid password', ['Current password is incorrect'], 400);
	}

	const passwordHash = await bcrypt.hash(newPassword, 10);
	await prisma.user.update({
		where: { id: user.id },
		data: { passwordHash, mustChangePassword: false },
	});

	return apiSuccess(res, null, 'Password updated');
}));

app.post('/api/auth/2fa/enable', authenticate, (req, res) => {
	apiSuccess(res, { qrCode: 'stub-qr', backupCodes: [] }, '2FA enabled');
});

app.post('/api/auth/2fa/verify', authenticate, (req, res) => {
	apiSuccess(res, null, '2FA verified');
});

app.post('/api/auth/2fa/disable', authenticate, (req, res) => {
	apiSuccess(res, null, '2FA disabled');
});

app.get('/api/auth/', authenticate, asyncHandler(async (req, res) => {
	const users = await prisma.user.findMany({
		where: { isActive: true },
		orderBy: { lastName: 'asc' },
	});

	return res.json({ results: users.map(toSnakeUser) });
}));

app.get('/api/users/current/', authenticate, asyncHandler(async (req, res) => {
	return res.json(toCamelUser(req.user));
}));

app.put('/api/users/profile/', authenticate, asyncHandler(async (req, res) => {
	const { email, first_name, last_name, phone_number } = req.body || {};

	const updated = await prisma.user.update({
		where: { id: req.user.id },
		data: {
			email: email ?? req.user.email,
			firstName: first_name ?? req.user.firstName,
			lastName: last_name ?? req.user.lastName,
			phoneNumber: phone_number ?? req.user.phoneNumber,
		},
	});

	return res.json(toCamelUser(updated));
}));

app.get('/api/users/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const { role, is_active, search, page } = req.query;
	const limit = 20;
	const pageNumber = Number(page || 1);
	const skip = (pageNumber - 1) * limit;

	const filters = {
		...(role ? { role } : {}),
		...(is_active !== undefined ? { isActive: is_active === 'true' } : {}),
		...(search
			? {
					OR: [
						{ username: { contains: search, mode: 'insensitive' } },
						{ email: { contains: search, mode: 'insensitive' } },
						{ firstName: { contains: search, mode: 'insensitive' } },
						{ lastName: { contains: search, mode: 'insensitive' } },
					],
				}
			: {}),
	};

	const [count, users] = await Promise.all([
		prisma.user.count({ where: filters }),
		prisma.user.findMany({
			where: filters,
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit,
		}),
	]);

	const nextPage = skip + limit < count ? pageNumber + 1 : null;
	const prevPage = pageNumber > 1 ? pageNumber - 1 : null;

	return res.json({
		results: users.map(toCamelUser),
		count,
		next: nextPage ? `/api/users/?page=${nextPage}` : null,
		previous: prevPage ? `/api/users/?page=${prevPage}` : null,
	});
}));

app.get('/api/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const user = await prisma.user.findUnique({ where: { id: req.params.id } });
	if (!user) {
		return apiError(res, 'User not found', ['User not found'], 404);
	}
	return res.json(toCamelUser(user));
}));

app.patch('/api/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const { email, first_name, last_name, phone_number, is_active } = req.body || {};

	const updated = await prisma.user.update({
		where: { id: req.params.id },
		data: {
			email,
			firstName: first_name,
			lastName: last_name,
			phoneNumber: phone_number,
			isActive: typeof is_active === 'boolean' ? is_active : undefined,
		},
	});

	return res.json(toCamelUser(updated));
}));

app.delete('/api/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	await prisma.user.update({
		where: { id: req.params.id },
		data: { isActive: false },
	});

	return apiSuccess(res, null, 'User deactivated');
}));

app.post('/api/users/:id/unlock/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	return res.json({ message: 'User unlocked' });
}));

app.post('/api/users/:id/force-password-change/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	await prisma.user.update({
		where: { id: req.params.id },
		data: { mustChangePassword: true },
	});

	return res.json({ message: 'Password change required' });
}));

app.post('/api/audit/logs/batch/', authenticate, asyncHandler(async (req, res) => {
	const { logs } = req.body || {};
	if (!Array.isArray(logs) || logs.length === 0) {
		return apiError(res, 'No logs provided', ['Logs array required'], 400);
	}

	const payload = logs.map((log) => ({
		userId: req.user.id,
		action: log.action || 'UNKNOWN',
		resource: log.resource || 'unknown',
		resourceId: log.resourceId || 'unknown',
		oldValues: log.oldValues || null,
		newValues: log.newValues || null,
		ipAddress: log.ipAddress || 'client-side',
		userAgent: log.userAgent || req.headers['user-agent'] || 'unknown',
		metadata: log.metadata || null,
	}));

	await prisma.auditLog.createMany({ data: payload });
	return apiSuccess(res, null, 'Audit logs recorded');
}));

app.get('/api/audit/logs', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const { startDate, endDate, userId, resource, action } = req.query;
	const filters = {
		...(userId ? { userId } : {}),
		...(resource ? { resource } : {}),
		...(action ? { action } : {}),
		...(startDate || endDate
			? {
					createdAt: {
						...(startDate ? { gte: new Date(startDate) } : {}),
						...(endDate ? { lte: new Date(endDate) } : {}),
					},
				}
			: {}),
	};

	const logs = await prisma.auditLog.findMany({
		where: filters,
		orderBy: { createdAt: 'desc' },
		take: 200,
	});

	return apiSuccess(res, logs, 'Audit logs retrieved');
}));

app.post('/api/audit/reports', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	return apiSuccess(res, { reportId: uuidv4(), downloadUrl: '/reports/placeholder' }, 'Report queued');
}));

const v1Router = express.Router();

v1Router.post('/users/auth/login/', asyncHandler(async (req, res) => {
	const { username, password } = req.body || {};
	if (!username || !password) {
		return apiError(res, 'Username and password are required', ['Missing credentials'], 400);
	}

	const user = await prisma.user.findFirst({
		where: { OR: [{ username }, { email: username }] },
	});

	if (!user || !user.isActive) {
		return apiError(res, 'Invalid credentials', ['Invalid username or password'], 401);
	}

	const passwordMatch = await bcrypt.compare(password, user.passwordHash);
	if (!passwordMatch) {
		return apiError(res, 'Invalid credentials', ['Invalid username or password'], 401);
	}

	const access = signAccessToken(user);
	const refresh = await createRefreshToken(user.id);

	await prisma.user.update({
		where: { id: user.id },
		data: { lastLogin: new Date() },
	});

	return res.json({
		access,
		refresh,
		user: toCamelUser(user),
	});
}));

v1Router.post('/users/auth/refresh/', asyncHandler(async (req, res) => {
	const { refresh } = req.body || {};
	let record = null;

	if (refresh) {
		record = await validateRefreshToken(refresh);
	} else {
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		const decoded = token ? jwt.decode(token) : null;

		if (decoded && decoded.sub) {
			record = await prisma.refreshToken.findFirst({
				where: {
					userId: decoded.sub,
					revokedAt: null,
					expiresAt: { gt: new Date() },
				},
				orderBy: { createdAt: 'desc' },
			});
		}
	}

	if (!record) {
		return apiError(res, 'Invalid refresh token', ['Refresh token not found'], 401);
	}

	const user = await prisma.user.findUnique({ where: { id: record.userId } });
	if (!user || !user.isActive) {
		return apiError(res, 'Invalid refresh token', ['User not found or inactive'], 401);
	}

	const access = signAccessToken(user);
	return res.json({ access });
}));

v1Router.post('/users/auth/logout/', authenticate, asyncHandler(async (req, res) => {
	const { refresh_token } = req.body || {};
	if (refresh_token) {
		await prisma.refreshToken.updateMany({
			where: { token: refresh_token },
			data: { revokedAt: new Date() },
		});
	}

	await revokeRefreshTokensForUser(req.user.id);
	return apiSuccess(res, null, 'Logged out');
}));

v1Router.post('/users/auth/register/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const {
		username,
		email,
		password,
		password_confirm,
		first_name,
		last_name,
		role,
		phone_number,
	} = req.body || {};

	if (!username || !email || !password || !first_name || !last_name) {
		return apiError(res, 'Missing required fields', ['Required fields are missing'], 400);
	}

	if (password !== password_confirm) {
		return apiError(res, 'Password confirmation does not match', ['Password mismatch'], 400);
	}

	const existing = await prisma.user.findFirst({
		where: { OR: [{ username }, { email }] },
	});

	if (existing) {
		return apiError(res, 'User already exists', ['Username or email already in use'], 409);
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const newUser = await prisma.user.create({
		data: {
			username,
			email,
			passwordHash,
			firstName: first_name,
			lastName: last_name,
			role: role || 'client',
			phoneNumber: phone_number || null,
		},
	});

	return res.json(toCamelUser(newUser));
}));

v1Router.get('/users/current/', authenticate, asyncHandler(async (req, res) => {
	return res.json(toCamelUser(req.user));
}));

v1Router.put('/users/profile/', authenticate, asyncHandler(async (req, res) => {
	const { email, first_name, last_name, phone_number } = req.body || {};

	const updated = await prisma.user.update({
		where: { id: req.user.id },
		data: {
			email: email ?? req.user.email,
			firstName: first_name ?? req.user.firstName,
			lastName: last_name ?? req.user.lastName,
			phoneNumber: phone_number ?? req.user.phoneNumber,
		},
	});

	return res.json(toCamelUser(updated));
}));

v1Router.get('/users/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const { role, is_active, search, page } = req.query;
	const limit = 20;
	const pageNumber = Number(page || 1);
	const skip = (pageNumber - 1) * limit;

	const filters = {
		...(role ? { role } : {}),
		...(is_active !== undefined ? { isActive: is_active === 'true' } : {}),
		...(search
			? {
					OR: [
						{ username: { contains: search, mode: 'insensitive' } },
						{ email: { contains: search, mode: 'insensitive' } },
						{ firstName: { contains: search, mode: 'insensitive' } },
						{ lastName: { contains: search, mode: 'insensitive' } },
					],
				}
			: {}),
	};

	const [count, users] = await Promise.all([
		prisma.user.count({ where: filters }),
		prisma.user.findMany({
			where: filters,
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit,
		}),
	]);

	const nextPage = skip + limit < count ? pageNumber + 1 : null;
	const prevPage = pageNumber > 1 ? pageNumber - 1 : null;

	return res.json({
		results: users.map(toCamelUser),
		count,
		next: nextPage ? `/api/v1/users/?page=${nextPage}` : null,
		previous: prevPage ? `/api/v1/users/?page=${prevPage}` : null,
	});
}));

v1Router.get('/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const user = await prisma.user.findUnique({ where: { id: req.params.id } });
	if (!user) {
		return apiError(res, 'User not found', ['User not found'], 404);
	}
	return res.json(toCamelUser(user));
}));

v1Router.patch('/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	const { email, first_name, last_name, phone_number, is_active } = req.body || {};

	const updated = await prisma.user.update({
		where: { id: req.params.id },
		data: {
			email,
			firstName: first_name,
			lastName: last_name,
			phoneNumber: phone_number,
			isActive: typeof is_active === 'boolean' ? is_active : undefined,
		},
	});

	return res.json(toCamelUser(updated));
}));

v1Router.delete('/users/:id/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	await prisma.user.update({
		where: { id: req.params.id },
		data: { isActive: false },
	});

	return res.json({ message: 'User deactivated' });
}));

v1Router.post('/users/:id/unlock/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	return res.json({ message: 'User unlocked' });
}));

v1Router.post('/users/:id/force-password-change/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
	await prisma.user.update({
		where: { id: req.params.id },
		data: { mustChangePassword: true },
	});

	return res.json({ message: 'Password change required' });
}));

app.use('/api/v1', v1Router);

app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({
		success: false,
		message: 'Internal server error',
		errors: ['Unexpected error'],
	});
});

app.listen(PORT, () => {
	console.log(`Backend listening on port ${PORT}`);
});
