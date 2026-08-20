module.exports = {
  baseUrl: process.env.EASYSLIP_BASE_URL || 'https://api.easyslip.com/v2',
  apiKey: process.env.EASYSLIP_API_KEY || null,
  timeout: Number(process.env.EASYSLIP_TIMEOUT_MS) || 10000
};
