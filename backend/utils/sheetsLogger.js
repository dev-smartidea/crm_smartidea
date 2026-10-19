const { google } = require('googleapis');

// Cache verified sheet tabs in memory to avoid calling get/batchUpdate on every request
const verifiedSheets = new Set();

/**
 * Ensure the target worksheet exists in the spreadsheet.
 * If not found, attempt to create it and populate headers.
 * If creation fails, fallback to the first existing sheet tab.
 * @param {google.sheets_v4.Sheets} sheets
 * @param {string} spreadsheetId
 * @param {string} targetTabName
 * @returns {Promise<string>} The actual sheet tab name to use
 */
async function ensureWorksheetExists(sheets, spreadsheetId, targetTabName) {
  const cacheKey = `${spreadsheetId}:${targetTabName}`;
  if (verifiedSheets.has(cacheKey)) {
    return targetTabName;
  }

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets || [];
    const found = existingSheets.find(
      (s) => s.properties?.title === targetTabName
    );

    if (found) {
      verifiedSheets.add(cacheKey);
      return targetTabName;
    }

    // Sheet tab doesn't exist, create it
    console.log(`[sheetsLogger] Tab '${targetTabName}' not found. Creating new sheet tab...`);
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetTabName,
                },
              },
            },
          ],
        },
      });

      // Add standard column headers
      const headers = [
        'Timestamp',
        'Display Name',
        'LINE User ID',
        'CRM User ID',
        'Message',
        'Amount',
        'Currency',
        'Confidence',
        'Status',
      ];

      const escapedName = targetTabName.replace(/'/g, "''");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${escapedName}'!A1:I1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers],
        },
      });

      console.log(`[sheetsLogger] ✅ Successfully created tab '${targetTabName}' with headers.`);
      verifiedSheets.add(cacheKey);
      return targetTabName;
    } catch (createErr) {
      console.warn(`[sheetsLogger] Failed to create tab '${targetTabName}': ${createErr.message}. Falling back to first sheet.`);
      if (existingSheets.length > 0 && existingSheets[0].properties?.title) {
        const fallbackTitle = existingSheets[0].properties.title;
        console.log(`[sheetsLogger] Using fallback sheet: '${fallbackTitle}'`);
        return fallbackTitle;
      }
      return targetTabName;
    }
  } catch (err) {
    console.warn(`[sheetsLogger] Could not inspect spreadsheet metadata: ${err.message}. Using target '${targetTabName}'.`);
    return targetTabName;
  }
}

/**
 * Log topup request to Google Sheets
 * @param {Object} data - topup request data
 * @returns {Promise<boolean>} - success or failure
 */
async function logToGoogleSheets(data) {
  try {
    const keyJson = process.env.GOOGLE_SHEETS_KEY_JSON;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const targetTabName = process.env.GOOGLE_SHEET_TAB_NAME || 'LINE Topup Requests';

    if (!keyJson || !sheetId) {
      console.warn('[sheetsLogger] Missing GOOGLE_SHEETS_KEY_JSON or GOOGLE_SHEET_ID');
      return false;
    }

    // Parse the JSON key safely
    let credentials;
    try {
      credentials = typeof keyJson === 'object' ? keyJson : JSON.parse(keyJson);
    } catch (parseErr) {
      console.error('[sheetsLogger] Failed to parse GOOGLE_SHEETS_KEY_JSON:', parseErr.message);
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Ensure the sheet tab exists (or auto-create / fallback)
    const actualTabName = await ensureWorksheetExists(sheets, sheetId, targetTabName);
    const escapedTabName = actualTabName.replace(/'/g, "''");

    // Prepare row data
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      data.displayName || 'Unknown',
      data.lineUserId || '',
      data.crmUserId || '',
      data.messageText || '',
      data.amount !== null && data.amount !== undefined ? data.amount : '',
      data.currency || 'THB',
      data.confidence !== null && data.confidence !== undefined ? data.confidence : '',
      data.status || 'pending',
    ];

    // Append row to sheet (enclosed in single quotes for spaces)
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A:I`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });

    console.log(`[sheetsLogger] ✅ Logged to Google Sheets ('${actualTabName}'). Updates:`, result.data.updates);
    return true;
  } catch (error) {
    console.error('[sheetsLogger] Error logging to Google Sheets:', error.message);
    // Invalidate cache in case tab was renamed/deleted
    verifiedSheets.clear();
    return false;
  }
}

module.exports = {
  logToGoogleSheets,
};
