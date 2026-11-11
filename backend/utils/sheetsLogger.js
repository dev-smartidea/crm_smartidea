const { google } = require('googleapis');
const Customer = require('../models/Customer');
const Service = require('../models/Service');

const EXCLUDED_LINE_USER_IDS = new Set(['U774900367ac4f1e841649458af6650e5']);
const EXCLUDED_TEXT_PATTERNS = ['acc.smartidea'];
const SHEET_HEADERS = [
  'Timestamp',
  'เวลาที่ส่ง',
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
  'เวลาที่โอน',
  'LINE Event IDs',
];

function getMonthlySheetTabName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `LINE_${year}-${month}`;
}

function getSheetStatus({ amount, customerName, cid, imageUrl, crmCreated = false }) {
  const parsedAmount = Number(String(amount ?? '').replace(/,/g, '').trim());
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const hasCustomerName = Boolean(String(customerName || '').trim());
  const hasCid = Boolean(String(cid || '').trim());
  const hasImage = Boolean(String(imageUrl || '').trim());

  if (!hasAmount || !hasCustomerName || !hasCid || !hasImage) return 'incomplete';
  return crmCreated ? 'created_in_crm' : 'ready';
}

function formatSendTime(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return '';
  const timestampValue = String(timestamp).trim();
  const dateValue = typeof timestamp === 'number' || /^\d{10,13}$/.test(timestampValue)
    ? Number(timestamp)
    : timestamp;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function formatTransferTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const rawTime = String(value).trim();
  const colonTime = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  const compactTime = rawTime.match(/^\d{3,4}$/);
  if (!colonTime && !compactTime) return '';

  const digits = compactTime ? rawTime.padStart(4, '0') : null;
  const hours = Number(colonTime ? colonTime[1] : digits.slice(0, 2));
  const minutes = Number(colonTime ? colonTime[2] : digits.slice(2));
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function escapeRegex(text) {
  return String(text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function normalizeCustomerName(name) {
  return String(name || '')
    .trim()
    .replace(/^(บริษัท|บจก\.|หจก\.|บมจ\.)\s*/i, '')
    .replace(/\s*(จำกัด|มหาชน)$/i, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('th');
}

function extractCustomerContext(messageText) {
  const rawText = String(messageText || '');
  const nameMatch = rawText.match(/(?:ลูกค้า|customer|company|ชื่อบริษัท|ชื่อลูกค้า)\s*[:\-]?\s*([^\r\n|]+)/i);
  const cidMatch = rawText.match(/(?:CID|customerId|customer id|Service ID|service id)\s*[:\-]?\s*([A-Za-z0-9-]+)/i);

  return {
    customerName: nameMatch?.[1]?.trim() || null,
    cid: cidMatch?.[1]?.trim() || null,
  };
}

function getCustomerNameQuery(name) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  const coreName = trimmed
    .replace(/^(บริษัท|บจก\.|หจก\.|บมจ\.)\s*/i, '')
    .replace(/\s*(จำกัด|มหาชน)$/i, '')
    .trim();
  const variants = [...new Set([trimmed, coreName].filter((value) => value.length >= 2))];
  return variants.map((value) => ({
    name: new RegExp(`^${escapeRegex(value)}$`, 'i'),
  }));
}

function formatCustomerDisplayName(extractedCustomerName, databaseCustomerName) {
  const extracted = String(extractedCustomerName || '').trim();
  const database = String(databaseCustomerName || '').trim();

  if (!extracted && !database) return '';
  if (!extracted) return database;
  if (!database) return extracted;

  const sameName = extracted.localeCompare(database, 'th', { sensitivity: 'base' }) === 0;
  if (sameName) return extracted;

  const extractedNormalized = extracted.replace(/\s+/g, ' ').trim();
  const databaseNormalized = database.replace(/\s+/g, ' ').trim();
  if (extractedNormalized.includes(databaseNormalized) || databaseNormalized.includes(extractedNormalized)) {
    return extractedNormalized;
  }

  return `${extractedNormalized} (${databaseNormalized})`;
}

async function resolveCustomerContext({ customerName, cid, messageText, serviceType }) {
  const extractedContext = extractCustomerContext(messageText);
  let resolvedCustomerName = customerName || extractedContext.customerName;
  let resolvedCid = cid || extractedContext.cid;

  try {
    if (resolvedCid) {
      const rawCid = String(resolvedCid).trim();
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
        const databaseCustomerName = service.customerId.name || null;
        resolvedCustomerName = formatCustomerDisplayName(resolvedCustomerName, databaseCustomerName);
        resolvedCid = service.cid || service.customerIdField || resolvedCid;
      }
    }

    if (resolvedCustomerName) {
      const customerCandidates = await Customer.find({
        $or: getCustomerNameQuery(resolvedCustomerName),
      });
      const normalizedName = normalizeCustomerName(resolvedCustomerName);
      const exactMatches = customerCandidates.filter(
        (candidate) => normalizeCustomerName(candidate.name) === normalizedName
      );
      const customer = exactMatches.length === 1
        ? exactMatches[0]
        : (exactMatches.length === 0 && customerCandidates.length === 1 ? customerCandidates[0] : null);

      if (customer) {
        resolvedCustomerName = formatCustomerDisplayName(resolvedCustomerName, customer.name);
        const services = await Service.find({ customerId: customer._id });
        const matchingServices = services.filter((item) => {
          if (!item.cid && !item.customerIdField) return false;
          if (!serviceType) return true;
          const normalizedType = /google/i.test(serviceType) ? 'Google Ads'
            : (/facebook/i.test(serviceType) ? 'Facebook Ads'
              : (/domain|hosting|web|เว็บ/i.test(serviceType) ? 'เว็บไซต์' : null));
          return !normalizedType || item.serviceType === normalizedType;
        });
        const serviceCids = [...new Set(matchingServices.map((item) => item.cid || item.customerIdField))];
        if (!resolvedCid && serviceCids.length === 1) {
          resolvedCid = serviceCids[0];
        }
      }
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

async function ensureLineEventColumn(sheets, spreadsheetId, tabName) {
  const escapedTabName = tabName.replace(/'/g, "''");
  for (const [column, expectedHeader] of [['P', 'เวลาที่โอน'], ['Q', 'LINE Event IDs']]) {
    const range = `'${escapedTabName}'!${column}1`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const header = result.data.values?.[0]?.[0] || '';
    if (header === expectedHeader) continue;
    if (header) {
      throw new Error(`Google Sheets column ${column} is already in use ('${header}'); cannot add ${expectedHeader}`);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values: [[expectedHeader]] },
    });
  }
}

async function findRowByLineEventId(sheets, spreadsheetId, tabName, eventKey) {
  if (!eventKey) return null;
  const escapedTabName = tabName.replace(/'/g, "''");
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${escapedTabName}'!Q:Q`,
  });
  const values = result.data.values || [];
  for (let index = 1; index < values.length; index += 1) {
    const eventIds = String(values[index]?.[0] || '').split('|');
    if (eventIds.includes(eventKey)) return index + 1;
  }
  return null;
}

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
      const escapedName = targetTabName.replace(/'/g, "''");
      const headerResult = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${escapedName}'!A1:B1`,
      });
      const currentHeaders = headerResult.data.values?.[0] || [];
      const secondHeader = String(currentHeaders[1] || '').trim().toLowerCase();

      if (secondHeader === 'display name') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              insertDimension: {
                range: {
                  sheetId: found.properties.sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 1,
                  endIndex: 2,
                },
              },
            }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${escapedName}'!A1:Q1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [SHEET_HEADERS] },
        });
      } else if (currentHeaders.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${escapedName}'!A1:Q1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [SHEET_HEADERS] },
        });
      }

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
      const escapedName = targetTabName.replace(/'/g, "''");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${escapedName}'!A1:Q1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [SHEET_HEADERS],
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
 * @param {string} data.transTime - Transfer time extracted from the bank slip
 * @param {string} data.status - Status is calculated as ready or incomplete from required fields
 * @param {number|string} data.sentAt - LINE event timestamp
 * @returns {Promise<{sheetTab: string, rowNumber: number}|false>} - appended row reference or failure
 */
async function logToGoogleSheets(data) {
  try {
    const resolvedContext = await resolveCustomerContext({
      customerName: data.customerName,
      cid: data.cid,
      messageText: data.messageText,
      serviceType: data.serviceType,
    });

    const enrichedData = {
      ...data,
      customerName: resolvedContext.customerName || data.customerName || '',
      cid: resolvedContext.cid || data.cid || '',
      messageText: resolvedContext.messageText || data.messageText || '',
    };
    enrichedData.status = getSheetStatus(enrichedData);

    if (shouldSkipGoogleSheetEntry(enrichedData)) {
      console.log('[sheetsLogger] Skipping Google Sheet write for excluded LINE User ID or acc.smartidea text.');
      return false;
    }

    const keyJson = process.env.GOOGLE_SHEETS_KEY_JSON;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const targetTabName = process.env.GOOGLE_SHEET_TAB_NAME || getMonthlySheetTabName();

    if (!keyJson || !sheetId) {
      console.warn('[sheetsLogger] Missing GOOGLE_SHEETS_KEY_JSON or GOOGLE_SHEET_ID');
      throw new Error('Google Sheets credentials are not configured');
    }

    // Parse the JSON key safely
    let credentials;
    try {
      credentials = typeof keyJson === 'object' ? keyJson : JSON.parse(keyJson);
    } catch (parseErr) {
      console.error('[sheetsLogger] Failed to parse GOOGLE_SHEETS_KEY_JSON:', parseErr.message);
      throw parseErr;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Ensure the sheet tab exists (or auto-create / fallback)
    const actualTabName = await ensureWorksheetExists(sheets, sheetId, targetTabName);
    const escapedTabName = actualTabName.replace(/'/g, "''");
    await ensureLineEventColumn(sheets, sheetId, actualTabName);
    const existingEventRow = await findRowByLineEventId(sheets, sheetId, actualTabName, data.eventKey);
    if (existingEventRow) {
      return { sheetTab: actualTabName, rowNumber: existingEventRow };
    }

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
      formatSendTime(enrichedData.sentAt),
      enrichedData.displayName || 'Unknown',
      enrichedData.lineUserId || '',
      enrichedData.crmUserId || '',
      enrichedData.messageText || '',
      enrichedData.amount !== null && enrichedData.amount !== undefined ? enrichedData.amount : '',
      enrichedData.currency || 'THB',
      enrichedData.serviceType || '',
      enrichedData.customerName || '',
      enrichedData.cid || '',
      enrichedData.withholding ? 'Yes' : 'No',
      enrichedData.confidence !== null && enrichedData.confidence !== undefined ? enrichedData.confidence : '',
      formattedImage,
      enrichedData.status,
      formatTransferTime(enrichedData.transTime),
      enrichedData.eventKey || '',
    ];

    // Append row to sheet (enclosed in single quotes for spaces)
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A:Q`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });

    const updatedRange = result.data.updates?.updatedRange || '';
    const rowNumber = Number(updatedRange.match(/![A-Z]+(\d+):?/i)?.[1]);
    if (!rowNumber) {
      throw new Error('Google Sheets appended a row but did not return its row number');
    }

    console.log(`[sheetsLogger] ✅ Logged to Google Sheets ('${actualTabName}'). Updates:`, result.data.updates);
    return { sheetTab: actualTabName, rowNumber };
  } catch (error) {
    console.error('[sheetsLogger] Error logging to Google Sheets:', error.message);
    // Invalidate cache in case tab was renamed/deleted
    verifiedSheets.clear();
    throw error;
  }
}

/**
 * Update a specific row, or fall back to the most recent matching row for a lineUserId
 * @param {string} lineUserId
 * @param {Object} updateData
 * @returns {Promise<{sheetTab: string, rowNumber: number}|false>}
 */
async function updateLatestRowForUser(lineUserId, updateData) {
  try {
    const resolvedContext = await resolveCustomerContext({
      customerName: updateData?.customerName,
      cid: updateData?.cid,
      messageText: updateData?.messageText,
      serviceType: updateData?.serviceType,
    });

    const enrichedUpdateData = {
      ...updateData,
      customerName: resolvedContext.customerName || updateData?.customerName || '',
      cid: resolvedContext.cid || updateData?.cid || '',
      messageText: resolvedContext.messageText || updateData?.messageText || '',
    };

    if (shouldSkipGoogleSheetEntry({
      lineUserId,
      messageText: enrichedUpdateData.messageText,
      displayName: enrichedUpdateData.displayName,
      customerName: enrichedUpdateData.customerName,
    })) {
      console.log('[sheetsLogger] Skipping Google Sheet row update for excluded LINE User ID or acc.smartidea text.');
      return false;
    }

    const keyJson = process.env.GOOGLE_SHEETS_KEY_JSON;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const targetTabName = process.env.GOOGLE_SHEET_TAB_NAME || getMonthlySheetTabName();

    if (!keyJson || !sheetId || !lineUserId) {
      throw new Error('Google Sheets credentials or LINE user ID are missing');
    }
    if (updateData.sheetRowRef
      && (!updateData.sheetRowRef.sheetTab || Number(updateData.sheetRowRef.rowNumber) <= 1)) {
      throw new Error('Invalid sheet row reference; refusing to update a different row');
    }

    let credentials;
    try {
      credentials = typeof keyJson === 'object' ? keyJson : JSON.parse(keyJson);
    } catch (error) {
      throw new Error(`Failed to parse GOOGLE_SHEETS_KEY_JSON: ${error.message}`);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const actualTabName = updateData.sheetRowRef?.sheetTab
      || await ensureWorksheetExists(sheets, sheetId, targetTabName);
    const escapedTabName = actualTabName.replace(/'/g, "''");
    await ensureLineEventColumn(sheets, sheetId, actualTabName);
    const existingEventRow = await findRowByLineEventId(sheets, sheetId, actualTabName, updateData.eventKey);
    if (existingEventRow) {
      return { sheetTab: actualTabName, rowNumber: existingEventRow };
    }

    let targetRowIndex = Number(updateData.sheetRowRef?.rowNumber) || -1;
    let currentRow;
    if (targetRowIndex > 1) {
      const rowResult = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${escapedTabName}'!A${targetRowIndex}:Q${targetRowIndex}`,
      });
      currentRow = rowResult.data.values?.[0];
      if (!currentRow || currentRow[3] !== lineUserId) {
        throw new Error('Referenced Google Sheets row is missing or belongs to another LINE user');
      }
    } else {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${escapedTabName}'!A:Q`,
      });

      const rows = res.data.values || [];
      if (rows.length <= 1) return false;

      // Search from bottom up for matching lineUserId within the last 30 minutes.
      const now = Date.now();
      const maxAgeMs = 30 * 60 * 1000;

      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        const rowTime = new Date(row[0]).getTime();

        if (row[3] === lineUserId && !Number.isNaN(rowTime) && (now - rowTime) < maxAgeMs) {
          targetRowIndex = i + 1;
          currentRow = row;
          break;
        }
      }
    }

    if (targetRowIndex <= 1 || !currentRow) return false;

    let formattedImage = currentRow[13] || '';
    if (updateData.imageUrl) {
      formattedImage = String(updateData.imageUrl).startsWith('=')
        ? updateData.imageUrl
        : `=HYPERLINK("${updateData.imageUrl}", IMAGE("${updateData.imageUrl}"))`;
    }

    const currentEventIds = String(currentRow[16] || '').split('|').filter(Boolean);
    if (updateData.eventKey && !currentEventIds.includes(updateData.eventKey)) {
      currentEventIds.push(updateData.eventKey);
    }
    const updatedRow = [
      currentRow[0], // Keep original timestamp
      formatSendTime(enrichedUpdateData.sentAt) || currentRow[1] || '',
      enrichedUpdateData.displayName || currentRow[2] || 'Unknown',
      currentRow[3], // LINE User ID
      enrichedUpdateData.crmUserId || currentRow[4] || '',
      enrichedUpdateData.messageText || currentRow[5] || '',
      enrichedUpdateData.amount !== null && enrichedUpdateData.amount !== undefined ? enrichedUpdateData.amount : (currentRow[6] || ''),
      enrichedUpdateData.currency || currentRow[7] || 'THB',
      enrichedUpdateData.serviceType || currentRow[8] || '',
      enrichedUpdateData.customerName || currentRow[9] || '',
      enrichedUpdateData.cid || currentRow[10] || '',
      enrichedUpdateData.withholding !== undefined ? (enrichedUpdateData.withholding ? 'Yes' : 'No') : (currentRow[11] || 'No'),
      enrichedUpdateData.confidence !== null && enrichedUpdateData.confidence !== undefined ? enrichedUpdateData.confidence : (currentRow[12] || ''),
      formattedImage,
      '',
      formatTransferTime(enrichedUpdateData.transTime) || currentRow[15] || '',
      currentEventIds.join('|'),
    ];
    updatedRow[14] = getSheetStatus({
      amount: updatedRow[6],
      customerName: updatedRow[9],
      cid: updatedRow[10],
      imageUrl: updatedRow[13],
      crmCreated: updateData.crmCreated === true || currentRow[14] === 'created_in_crm',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${escapedTabName}'!A${targetRowIndex}:Q${targetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [updatedRow],
      },
    });

    console.log(`[sheetsLogger] ✅ Successfully updated row ${targetRowIndex} for lineUserId: ${lineUserId}`);
    return { sheetTab: actualTabName, rowNumber: targetRowIndex };
  } catch (err) {
    console.error('[sheetsLogger] Error updating row for user:', err.message);
    throw err;
  }
}

module.exports = {
  logToGoogleSheets,
  updateLatestRowForUser,
  shouldSkipGoogleSheetEntry,
  formatTransferTime,
  resolveCustomerContext,
};
