const { google } = require('googleapis');
const Customer = require('../models/Customer');
const Service = require('../models/Service');

const EXCLUDED_LINE_USER_IDS = new Set(['U774900367ac4f1e841649458af6650e5']);
const EXCLUDED_TEXT_PATTERNS = ['acc.smartidea'];

function escapeRegex(text) {
  return String(text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

async function resolveCustomerContext({ customerName, cid, messageText, serviceType }) {
  let resolvedCustomerName = customerName || null;
  let resolvedCid = cid || null;

  try {
    if (cid) {
      const rawCid = String(cid).trim();
      const cleanDigits = rawCid.replace(/\D/g, '');
      const cidQueries = [
        { cid: rawCid },
        { customerIdField: rawCid },
      ];

      if (cleanDigits) {
        cidQueries.push({ cid: cleanDigits }, { customerIdField: cleanDigits });
        if (cleanDigits.length === 10) {
          const formatted = `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
          cidQueries.push({ cid: formatted }, { customerIdField: formatted });
        }
      }

      const service = await Service.findOne({ $or: cidQueries }).populate('customerId');
      if (service?.customerId) {
        resolvedCustomerName = service.customerId.name || resolvedCustomerName;
        resolvedCid = service.cid || service.customerIdField || resolvedCid;
      }
    }

    if (!resolvedCustomerName && customerName) {
      const trimmed = String(customerName).trim();
      const coreName = trimmed
        .replace(/^(บริษัท|บจก\.|หจก\.|บมจ\.)\s*/i, '')
        .replace(/\s*(จำกัด|มหาชน)$/i, '')
        .trim();

      const customerQueries = [{ name: new RegExp(escapeRegex(trimmed), 'i') }];
      if (coreName.length >= 2 && coreName !== trimmed) {
        customerQueries.push({ name: new RegExp(escapeRegex(coreName), 'i') });
      }

      const customer = await Customer.findOne({ $or: customerQueries });
      if (customer) {
        resolvedCustomerName = customer.name || resolvedCustomerName;
        const matchedService = await Service.findOne({ customerId: customer._id }).populate('customerId');
        if (matchedService) {
          resolvedCid = matchedService.cid || matchedService.customerIdField || resolvedCid;
        }
      }
    }

    if (!resolvedCustomerName && !resolvedCid && messageText) {
      const rawText = String(messageText);
      const nameMatch = rawText.match(/ลูกค้า\s*[:\-]?\s*([A-Za-z0-9ก-๙\s().,-]+)/i);
      const cidMatch = rawText.match(/(?:CID|cid|customerId|customer id|Service ID|service id)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
      if (nameMatch?.[1]) resolvedCustomerName = nameMatch[1].trim();
      if (cidMatch?.[1]) resolvedCid = cidMatch[1].trim();
    }
  } catch (error) {
    console.warn('[sheetsLogger] Could not resolve customer context from DB:', error.message);
  }

  const messageSegments = [];
  if (messageText && String(messageText).trim()) {
    messageSegments.push(String(messageText).trim());
  }

  const resolvedMessage = String(messageText || '').trim();
  const hasCustomerName = resolvedCustomerName && !resolvedMessage.toLowerCase().includes(String(resolvedCustomerName).toLowerCase());
  const hasCid = resolvedCid && !resolvedMessage.includes(String(resolvedCid));

  if (resolvedCustomerName && hasCustomerName) {
    messageSegments.push(`ลูกค้า: ${resolvedCustomerName}`);
  }
  if (resolvedCid && hasCid) {
    messageSegments.push(`CID: ${resolvedCid}`);
  }

  return {
    customerName: resolvedCustomerName,
    cid: resolvedCid,
    messageText: messageSegments.join(' | '),
    serviceType: serviceType || null,
  };
}

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
    const resolvedContext = await resolveCustomerContext({
      customerName: data.customerName,
      cid: data.cid,
      messageText: data.messageText,
      serviceType: data.serviceType,
    });

    const normalizedData = {
      ...data,
      customerName: resolvedContext.customerName || data.customerName || '',
      cid: resolvedContext.cid || data.cid || '',
      messageText: resolvedContext.messageText || data.messageText || '',
    };

    if (shouldSkipGoogleSheetEntry(normalizedData)) {
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
      normalizedData.displayName || 'Unknown',
      normalizedData.lineUserId || '',
      normalizedData.crmUserId || '',
      normalizedData.messageText || '',
      normalizedData.amount !== null && normalizedData.amount !== undefined ? normalizedData.amount : '',
      normalizedData.currency || 'THB',
      normalizedData.serviceType || '',
      normalizedData.customerName || '',
      normalizedData.cid || '',
      normalizedData.withholding ? 'Yes' : 'No',
      normalizedData.confidence !== null && normalizedData.confidence !== undefined ? normalizedData.confidence : '',
      formattedImage,
      normalizedData.status || 'pending',
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
    const resolvedContext = await resolveCustomerContext({
      customerName: updateData?.customerName,
      cid: updateData?.cid,
      messageText: updateData?.messageText,
      serviceType: updateData?.serviceType,
    });

    const normalizedData = {
      ...updateData,
      customerName: resolvedContext.customerName || updateData?.customerName || '',
      cid: resolvedContext.cid || updateData?.cid || '',
      messageText: resolvedContext.messageText || updateData?.messageText || '',
    };

    if (shouldSkipGoogleSheetEntry({
      lineUserId,
      messageText: normalizedData.messageText,
      displayName: normalizedData.displayName,
      customerName: normalizedData.customerName,
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
      normalizedData.displayName || currentRow[1] || 'Unknown',
      currentRow[2], // LINE User ID
      normalizedData.crmUserId || currentRow[3] || '',
      normalizedData.messageText || currentRow[4] || '',
      normalizedData.amount !== null && normalizedData.amount !== undefined ? normalizedData.amount : (currentRow[5] || ''),
      normalizedData.currency || currentRow[6] || 'THB',
      normalizedData.serviceType || currentRow[7] || '',
      normalizedData.customerName || currentRow[8] || '',
      normalizedData.cid || currentRow[9] || '',
      normalizedData.withholding !== undefined ? (normalizedData.withholding ? 'Yes' : 'No') : (currentRow[10] || 'No'),
      normalizedData.confidence !== null && normalizedData.confidence !== undefined ? normalizedData.confidence : (currentRow[11] || ''),
      formattedImage,
      normalizedData.status || currentRow[13] || 'pending',
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
