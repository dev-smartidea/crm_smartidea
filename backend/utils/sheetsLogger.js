const { google } = require('googleapis');

/**
 * Log topup request to Google Sheets
 * @param {Object} data - topup request data
 * @returns {Promise<boolean>} - success or failure
 */
async function logToGoogleSheets(data) {
  try {
    const keyJson = process.env.GOOGLE_SHEETS_KEY_JSON;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!keyJson || !sheetId) {
      console.warn('[sheetsLogger] Missing GOOGLE_SHEETS_KEY_JSON or GOOGLE_SHEET_ID');
      return false;
    }

    // Parse the JSON key
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare row data
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      data.displayName || 'Unknown',
      data.lineUserId || '',
      data.crmUserId || '',
      data.messageText || '',
      data.amount || '',
      data.currency || 'THB',
      data.confidence || '',
      data.status || 'pending',
    ];

    // Append row to sheet
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:I', // Append to columns A-I
      valueInputOption: 'RAW',
      resource: {
        values: [row],
      },
    });

    console.log(`[sheetsLogger] ✅ Logged to Google Sheets. Updates:`, result.data.updates);
    return true;
  } catch (error) {
    console.error('[sheetsLogger] Error logging to Google Sheets:', error.message);
    return false;
  }
}

module.exports = {
  logToGoogleSheets,
};
