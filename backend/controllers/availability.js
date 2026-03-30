const proxmox = require('../config/proxmox');

const NODE_NAME = process.env.PROXMOX_NODE || 'pve';
const STORAGE_NAME = process.env.PROXMOX_STORAGE || 'local-lvm';
const REQUEST_TIMEOUT_MS = Number(process.env.PROXMOX_REQUEST_TIMEOUT_MS || 8000);

if (!NODE_NAME || !STORAGE_NAME) {
	console.error('Invalid Proxmox config: NODE_NAME and STORAGE_NAME must be set');
	process.exit(1);
}

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
		})
	]);
}

function serverError(res, error, isProd = process.env.NODE_ENV === 'production') {
	const statusCode = error.statusCode || 500;
	const message = isProd ? 'Internal server error' : error.message;
	console.error(`[Error] ${error.message}`);
	return res.status(statusCode).json({
		success: false,
		error: message
	});
}

exports.getMemory = async (req, res) => {
	try {
		const status = await withTimeout(
			proxmox.nodes[NODE_NAME].status.$get(),
			REQUEST_TIMEOUT_MS,
			'Memory request'
		);
		
		if (!status || !status.memory) {
			throw new Error('Invalid Proxmox response');
		}

		res.json({
			success: true,
			available_memory: status.memory.available,
			total_memory: status.memory.total,
			free_memory: status.memory.free,
			used_memory: status.memory.used
		});
	} catch (error) {
		return serverError(res, error);
	}
};

exports.getCPU = async (req, res) => {
	try {
		const status = await withTimeout(
			proxmox.nodes[NODE_NAME].status.$get(),
			REQUEST_TIMEOUT_MS,
			'CPU request'
		);

		if (!status || status.cpu === undefined) {
			throw new Error('Invalid Proxmox response');
		}

		res.json({
			success: true,
			available_cpu: status.cpu
		});
	} catch (error) {
		return serverError(res, error);
	}
};

exports.getStorage = async (req, res) => {
	try {
		const status = await withTimeout(
			proxmox.nodes[NODE_NAME].storage.$get(),
			REQUEST_TIMEOUT_MS,
			'Storage request'
		);

		if (!Array.isArray(status)) {
			throw new Error('Invalid Proxmox response');
		}

		const target_storage = status.find(item => item && item.storage === STORAGE_NAME);

		if (!target_storage) {
			return res.status(404).json({
				success: false,
				message: `Storage '${STORAGE_NAME}' not found`
			});
		}

		res.json({
			success: true,
			available_storage: target_storage.avail,
			total_storage: target_storage.total
		});
	} catch (error) {
		return serverError(res, error);
	}
};