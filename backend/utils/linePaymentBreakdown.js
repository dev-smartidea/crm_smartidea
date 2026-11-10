const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

function normalizeDigits(value) {
  return String(value || '').replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

function parseAmount(value) {
  const amount = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getWithholdingRate(text) {
  const normalized = normalizeDigits(text);
  const hasWithholding = /หัก\s*ณ\s*ที่จ่าย|หักนำ|หักภาษี|หัก\s*[23]\s*(?:%|เปอร์เซ็นต์)|withholding|\bwht\b/i.test(normalized);
  if (!hasWithholding) return { declared: false, rate: null };

  const rates = new Set();
  const patterns = [
    /(?:หัก(?:\s*ณ\s*ที่จ่าย|\s*นำ|\s*ภาษี)?|withholding|\bwht\b)[^\d\n]{0,24}(2|3)\s*(?:%|เปอร์เซ็นต์)/gi,
    /(2|3)\s*(?:%|เปอร์เซ็นต์)[^\n]{0,32}(?:หัก|withholding|\bwht\b)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      rates.add(Number(match[1]));
    }
  }

  return {
    declared: true,
    rate: rates.size === 1 ? [...rates][0] : null,
    ambiguous: rates.size > 1,
  };
}

function getBreakdownCategory(text, serviceType) {
  const normalized = normalizeDigits(text).toLowerCase();
  const type = String(serviceType || '').toLowerCase();
  if (/ค่าคลิก|ค่าแอด|ค่าโฆษณา|ad\s*spend|click\s*fee/.test(normalized)) {
    return { name: 'click', amountCode: '11', taxCodes: { 2: '9', 3: '7' } };
  }
  if (/(?:ค่า(?:บริการ)?\s*(?:domain|hosting|โดเมน|โฮสติ้ง)|(?:domain|hosting)\s*fee)/.test(normalized)
    || /domain|hosting/.test(type)) {
    return { name: 'domain', amountCode: '20', taxCodes: { 2: '22', 3: '21' } };
  }
  if (/ค่าบริการ|service\s*fee/.test(normalized)) {
    if (/facebook|fb/.test(normalized) || type === 'facebook') {
      return { name: 'facebook_service', amountCode: '18', taxCodes: { 2: '8', 3: '10' } };
    }
    if (/google|gg/.test(normalized) || type === 'google') {
      return { name: 'google_service', amountCode: '14', taxCodes: { 2: '8', 3: '10' } };
    }
    return { name: 'service', amountCode: '15', taxCodes: { 2: '8', 3: '10' } };
  }
  return null;
}

function findGrossAmount(text, category) {
  const lines = normalizeDigits(text).split(/\r?\n/);
  const amountPattern = '([\\d,]+(?:\\.\\d{1,2})?)';

  for (const line of lines) {
    const explicitGross = line.match(new RegExp(
      `(?:ก่อนหัก(?:\\s*ณ\\s*ที่จ่าย)?|gross(?:\\s*amount)?)\\s*[:：=]?\\s*${amountPattern}`,
      'i'
    ));
    if (explicitGross) return parseAmount(explicitGross[1]);
    if (/(?:ยอดโอน|ยอดสุทธิ|ยอดตามสลิป|หัก\s*ณ\s*ที่จ่าย|หักนำ|หักภาษี|withholding|\bwht\b)/i.test(line)) {
      continue;
    }
  }

  const categoryPatterns = {
    click: /ค่าคลิก|ค่าแอด|ค่าโฆษณา|ad\s*spend|click\s*fee/i,
    domain: /domain|hosting|โดเมน|โฮสติ้ง/i,
    google_service: /ค่าบริการ|service\s*fee/i,
    facebook_service: /ค่าบริการ|service\s*fee/i,
    service: /ค่าบริการ|service\s*fee/i,
  };
  const categoryPattern = categoryPatterns[category.name];

  for (const line of lines) {
    if (!categoryPattern.test(line)
      || /ก่อนหัก|ยอดโอน|ยอดสุทธิ|ยอดตามสลิป|หัก\s*ณ\s*ที่จ่าย|หักนำ|หักภาษี|withholding|\bwht\b/i.test(line)) {
      continue;
    }
    const amountMatch = line.match(new RegExp(`${amountPattern}\\s*(?:บาท|฿|THB)?`, 'i'));
    if (amountMatch) return parseAmount(amountMatch[1]);
  }
  return null;
}

function findDeclaredWithholdingAmount(text, rate) {
  if (!rate) return null;
  const normalized = normalizeDigits(text);
  const number = '([\\d,]+(?:\\.\\d{1,2})?)';
  const patterns = [
    new RegExp(`(?:หัก(?:\\s*ณ\\s*ที่จ่าย|\\s*นำ|\\s*ภาษี)?|withholding|\\bwht\\b)[^\\n]*?${rate}\\s*(?:%|เปอร์เซ็นต์)[^\\d\\n]*${number}\\s*(?:บาท|฿|THB)`, 'i'),
    new RegExp(`${rate}\\s*(?:%|เปอร์เซ็นต์)[^\\n]*?(?:หัก\\s*ณ\\s*ที่จ่าย|หักนำ|หักภาษี|withholding|\\bwht\\b)[^\\d\\n]*${number}\\s*(?:บาท|฿|THB)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return parseAmount(match[1]);
  }
  return null;
}

function findDeclaredNetAmount(text) {
  const normalized = normalizeDigits(text);
  const match = normalized.match(
    /(?:ยอดโอนจริง|ยอดโอนสุทธิ|ยอดสุทธิ|ยอดตามสลิป)[^\d\n]{0,24}([\d,]+(?:\.\d{1,2})?)/i
  );
  return match ? parseAmount(match[1]) : null;
}

function parseLinePaymentBreakdown({ messageText, serviceType, slipAmount }) {
  const text = String(messageText || '');
  const withholding = getWithholdingRate(text);
  if (!withholding.declared) {
    return { declared: false, valid: false, isAmountMatched: false };
  }

  const category = getBreakdownCategory(text, serviceType);
  if (withholding.ambiguous || !withholding.rate || !category) {
    return { declared: true, valid: false, isAmountMatched: false, reason: 'ambiguous_rate_or_category' };
  }

  const grossAmount = findGrossAmount(text, category);
  const numericSlipAmount = parseAmount(slipAmount);
  if (!grossAmount || !numericSlipAmount) {
    return { declared: true, valid: false, isAmountMatched: false, reason: 'gross_or_slip_amount_missing' };
  }

  const withholdingAmount = Math.round(grossAmount * withholding.rate) / 100;
  const declaredWithholdingAmount = findDeclaredWithholdingAmount(text, withholding.rate);
  if (declaredWithholdingAmount !== null && Math.abs(declaredWithholdingAmount - withholdingAmount) > 0.01) {
    return { declared: true, valid: false, isAmountMatched: false, reason: 'withholding_amount_mismatch' };
  }

  const expectedNetAmount = Math.round((grossAmount - withholdingAmount) * 100) / 100;
  const declaredNetAmount = findDeclaredNetAmount(text);
  const netMatchesSlip = Math.abs(expectedNetAmount - numericSlipAmount) <= 0.02;
  const declaredNetMatchesSlip = declaredNetAmount === null
    || Math.abs(declaredNetAmount - numericSlipAmount) <= 0.02;
  if (!netMatchesSlip || !declaredNetMatchesSlip) {
    return {
      declared: true,
      valid: false,
      isAmountMatched: false,
      reason: 'net_amount_mismatch',
      expectedNetAmount,
    };
  }

  return {
    declared: true,
    valid: true,
    isAmountMatched: true,
    amount: numericSlipAmount,
    category: category.name,
    rate: withholding.rate,
    grossAmount,
    withholdingAmount,
    netAmount: expectedNetAmount,
    breakdowns: [
      { code: category.amountCode, amount: grossAmount, statusNote: 'รอบันทึกบัญชี', isAutoVat: false },
      { code: category.taxCodes[withholding.rate], amount: -withholdingAmount, statusNote: 'รอบันทึกบัญชี', isAutoVat: false },
    ],
  };
}

module.exports = {
  parseLinePaymentBreakdown,
};
