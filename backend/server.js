require('dotenv').config();

const cluster = require('cluster');
const os = require('os');
const express = require('express');
const cors = require('cors');

const availabilityRoutes = require('./routes/availability');
const auth = require('./middleware/auth');

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

function validateEnv() {
	const required = ['API_KEY_X', 'PROXMOX_HOST', 'PROXMOX_TOKEN_ID', 'PROXMOX_TOKEN_SECRET'];
	const missing = required.filter(key => !process.env[key]);
	if (missing.length > 0) {
		console.error(`Missing required env vars: ${missing.join(', ')}`);
		process.exit(1);
	}
}

function createApp() {
	const app = express();
	app.set('trust proxy', 1);

	const allowedOrigins = (process.env.CORS_OPTION_ORIGIN || '')
		.split(',')
		.map(origin => origin.trim())
		.filter(Boolean);

	app.use(cors({
		origin(origin, callback) {
			if (allowedOrigins.length === 0) {
				return callback(new Error('CORS not configured'));
			}
			if (!origin || allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error('CORS policy violation'));
		},
		methods: ['GET'],
		credentials: false,
		optionsSuccessStatus: 200,
		maxAge: 86400
	}));

	app.use(express.json({ limit: '10kb' }));

	app.use('/availability', auth, availabilityRoutes);

	app.get('/health', (req, res) => {
		res.status(200).json({ success: true, status: 'ok', pid: process.pid });
	});

	app.use((err, req, res, next) => {
		if (res.headersSent) {
			return;
		}
		const statusCode = err.statusCode || 500;
		return res.status(statusCode).json({
			success: false,
			message: isProd ? 'Internal server error' : err.message
		});
	});

	return app;
}

if (cluster.isPrimary) {
	const workers = Number(process.env.WEB_CONCURRENCY || os.availableParallelism() || os.cpus().length || 1);

	for (let i = 0; i < workers; i += 1) {
		cluster.fork();
	}

	cluster.on('exit', (worker) => {
		console.error(`Worker ${worker.process.pid} died. Restarting...`);
		cluster.fork();
	});

	['SIGTERM', 'SIGINT'].forEach(signal => {
		process.on(signal, () => {
			console.log(`${signal} received, shutting down gracefully...`);
			Object.values(cluster.workers).forEach(worker => worker.kill());
			process.exit(0);
		});
	});
} else {
	const app = createApp();
	const server = app.listen(PORT, () => {
		console.log(`Worker ${process.pid} listening on http://localhost:${PORT}`);
	});

	process.on('SIGTERM', () => {
		console.log('SIGTERM received, closing server...');
		server.close(() => {
			console.log('Server closed');
			process.exit(0);
		});
	});
}
