require('dotenv').config();
const crypto = require('crypto');

const expectedKey = process.env.API_KEY_X;

module.exports = (req, res, next) => {
	if (!expectedKey) {
		console.error('API_KEY_X not configured');
		return res.status(500).json({ success: false, message: 'Server misconfiguration' });
	}

	const token = req.header('x-api-key') || '';
	
	try {
		const isValid = crypto.timingSafeEqual(
			Buffer.from(token, 'utf8'),
			Buffer.from(expectedKey, 'utf8')
		);

		if (!isValid) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}
	} catch (error) {
		return res.status(401).json({ success: false, message: 'Unauthorized' });
	}
	
	next();
};