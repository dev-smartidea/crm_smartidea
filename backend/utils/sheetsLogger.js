const { google } = require('googleapis');

const EXCLUDED_LINE_USER_IDS = new Set(['U774900367ac4f1e841649458af6650e5']);
const EXCLUDED_TEXT_PATTERNS = ['acc.smartidea'];

function shouldSkipGoogleSheetEntry(data = {}) {
  const lineUserId = String(data.lineUserId || '').trim();
  const messageText = String(data.messageText || '').trim();
  const displayName = String(data.displayName || '').trim();
  const customerName = String(data.customerName || '').trim();

  if (EXCLUDED_LINE_USER_IDS.has(lineUserId)) {
    return true;
  }

  const haystacks = [messageText, displayName, customerName];
  const normalized = haystacks.map((value) => value.toLowerCase());
  return normalized.some((value) => EXCLUDED_TEXT_PATTERNS.some((pattern) => value.includes(pattern)));
}

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
        'Service Type',
        'Customer Name',
        'CID',
        'Withholding',
        'Confidence',
        'Image URL',
        'Status',
      ];

      const escapedName = targetTabName.replace(/'/g, "''");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${escapedName}'!A1:N1`,
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
 * @param {number} data.amount - Amount
 * @param {string} data.currency - Currency (default: THB)
 * @param {string} data.serviceType - Service type (google, facebook, domain, etc.)
 * @param {string} data.customerName - Customer name
 * @param {string} data.cid - Customer/Service ID
 * @param {boolean} data.withholding - WHT flag
 * @param {number} data.confidence - Confidence level
 * @param {string} data.imageUrl - Cloudinary image URL (receipt/slip)
 * @param {string} data.status - Status (confirmed, pending_review, etc.)
 * @returns {Promise<boolean>} - success or failure
 */
async function logToGoogleSheets(data) {
  try {
    if (shouldSkipGoogleSheetEntry(data)) {
      console.log('[sheetsLogger] Skipping Google Sheet write for excluded LINE User ID or acc.smartidea text.');
      return false;
    }

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

    // Format Image URL as Google Sheets formula so thumbnail appears in cell and clicking opens full image
    let formattedImage = '';
    if (data.imageUrl) {
      formattedImage = String(data.imageUrl).startsWith('=')
        ? data.imageUrl
        : `=HYPERLINK("${data.imageUrl}", IMAGE("${data.imageUrl}"))`;
    }

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
      data.serviceType || '',
      data.customerName || '',
      data.cid || '',
      data.withholding ? 'Yes' : 'No',
      data.confidence !== null && data.confidence !== undefined ? data.confidence : '',
      formattedImage,
      data.status || 'pending',
    ];

    // Append row to sheet (enclosed in single quotes for spaces)
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A:N`,
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

/**
 * Update the most recent matching row in Google Sheets for a lineUserId
 * @param {string} lineUserId
 * @param {Object} updateData
 * @returns {Promise<boolean>}
 */
async function updateLatestRowForUser(lineUserId, updateData) {
  try {
    if (shouldSkipGoogleSheetEntry({
      lineUserId,
      messageText: updateData?.messageText,
      displayName: updateData?.displayName,
      customerName: updateData?.customerName,
    })) {
      console.log('[sheetsLogger] Skipping Google Sheet row update for excluded LINE User ID or acc.smartidea text.');
      return false;
    }

    const keyJson = process.env.GOOGLE_SHEETS_KEY_JSON;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const targetTabName = process.env.GOOGLE_SHEET_TAB_NAME || 'LINE Topup Requests';

    if (!keyJson || !sheetId || !lineUserId) return false;

    let credentials;
    try {
      credentials = typeof keyJson === 'object' ? keyJson : JSON.parse(keyJson);
    } catch {
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const actualTabName = await ensureWorksheetExists(sheets, sheetId, targetTabName);
    const escapedTabName = actualTabName.replace(/'/g, "''");

    // Fetch existing rows
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A:N`,
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return false;

    // Search from bottom up for matching lineUserId (Column C, index 2) within last 30 minutes
    let targetRowIndex = -1;
    const now = Date.now();
    const maxAgeMs = 30 * 60 * 1000;

    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const rowUserId = row[2];
      const rowTime = new Date(row[0]).getTime();

      if (rowUserId === lineUserId) {
        if (!isNaN(rowTime) && (now - rowTime) < maxAgeMs) {
          targetRowIndex = i + 1; // 1-indexed for Sheets
          break;
        }
      }
    }

    if (targetRowIndex === -1) {
      return false;
    }

    const currentRow = rows[targetRowIndex - 1];

    let formattedImage = currentRow[12] || '';
    if (updateData.imageUrl) {
      formattedImage = String(updateData.imageUrl).startsWith('=')
        ? updateData.imageUrl
        : `=HYPERLINK("${updateData.imageUrl}", IMAGE("${updateData.imageUrl}"))`;
    }

    const updatedRow = [
      currentRow[0], // Keep original timestamp
      updateData.displayName || currentRow[1] || 'Unknown',
      currentRow[2], // LINE User ID
      updateData.crmUserId || currentRow[3] || '',
      updateData.messageText || currentRow[4] || '',
      updateData.amount !== null && updateData.amount !== undefined ? updateData.amount : (currentRow[5] || ''),
      updateData.currency || currentRow[6] || 'THB',
      updateData.serviceType || currentRow[7] || '',
      updateData.customerName || currentRow[8] || '',
      updateData.cid || currentRow[9] || '',
      updateData.withholding !== undefined ? (updateData.withholding ? 'Yes' : 'No') : (currentRow[10] || 'No'),
      updateData.confidence !== null && updateData.confidence !== undefined ? updateData.confidence : (currentRow[11] || ''),
      formattedImage,
      updateData.status || currentRow[13] || 'pending',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A${targetRowIndex}:N${targetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [updatedRow],
      },
    });

    console.log(`[sheetsLogger] ✅ Successfully updated row ${targetRowIndex} for lineUserId: ${lineUserId}`);
    return true;
  } catch (err) {
    console.error('[sheetsLogger] Error updating row for user:', err.message);
    return false;
  }
}

module.exports = {
  logToGoogleSheets,
  updateLatestRowForUser,
};
