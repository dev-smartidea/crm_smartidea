const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseJsonResponse(content) {
  if (!content) return null;

  let cleaned = String(content).trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const compact = cleaned.replace(/,\s*([}\]])/g, '$1');
    if (compact !== cleaned) {
      try {
        return JSON.parse(compact);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Extract detailed information from topup request message
 * @param {string} message - ข้อความจาก LINE
 * @returns {Promise<{
 *   amount: number|null,
 *   currency: string,
 *   serviceType: string|null,
 *   customerName: string|null,
 *   cid: string|null,
 *   withholding: boolean,
 *   withholdingRate: number|null,
 *   withholdingType: string|null,
 *   grossAmount: number|null,
 *   withholdingAmount: number|null,
 *   netAmount: number|null,
 *   confidence: number,
 *   rawExtraction: object
 * }>}
 */
async function extractMessageDetails(message) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[messageDetailExtractor] OPENAI_API_KEY not set');
      return {
        amount: null,
        currency: 'THB',
        serviceType: null,
        customerName: null,
        cid: null,
        withholding: false,
        withholdingRate: null,
        withholdingType: null,
        grossAmount: null,
        withholdingAmount: null,
        netAmount: null,
        confidence: 0,
        rawExtraction: { error: 'OPENAI_API_KEY not configured' }
      };
    }

    const systemPrompt = `You are an expert Thai message analyzer specialized in extracting payment/topup request details.

Your task: Extract structured information from Thai messages about payment/topup requests.

Return only valid JSON in this exact format, with no markdown fences and no surrounding text:
{
  "amount": number or null,
  "currency": "THB" or other,
  "serviceType": "google" | "facebook" | "domain" | "hosting" | "other" | null,
  "customerName": "customer name" or null,
  "cid": "CID/Service ID" or null,
  "withholding": boolean,
  "withholdingRate": 2 | 3 | null,
  "withholdingType": "click" | "service" | "domain" | null,
  "grossAmount": number or null,
  "withholdingAmount": number or null,
  "netAmount": number or null,
  "confidence": number (0-100),
  "extractionNotes": "explanation of extraction"
}

Service Type Indicators:
- "google" or "gg" → Google Ads (ค่าคลิก google, google ads)
- "facebook" or "fb" → Facebook Ads (ค่าคลิก facebook, facebook ads)
- "domain" or "hosting" or "web" → Domain/Hosting services
- Withholding rates are only 2% or 3%; preserve the stated rate exactly.
- "ค่าคลิก", "ค่าแอด", or ad spend → withholdingType: "click"
- "ค่าบริการ" → withholdingType: "service"
- "ค่า Domain", "ค่า Hosting", or "ค่าโดเมน" → withholdingType: "domain"
- "หัก ณ ที่จ่าย", "หักนำ", "หัก 2%/3%", WHT, or tax deduction → withholding: true
- Preserve the category and rate as a pair: click 2%/3%, service 2%/3%, or domain 2%/3%.
- CRM breakdown codes are: click 2% = 9, click 3% = 7; service 2% = 8, service 3% = 10; domain 2% = 22, domain 3% = 21.

Extract from these patterns:
- Amount: numbers + baht (บาท, ฿, THB)
- If amounts are itemized, extract grossAmount (before withholding), withholdingAmount (deduction), and netAmount (actual transfer/slip amount) separately.
- "amount" should be the actual transfer amount when clearly labeled; do not confuse gross, withholding, CID, or reference numbers.
- Check that grossAmount minus withholdingAmount equals netAmount, allowing only normal rounding to two decimal places. If the message values conflict, leave the uncertain fields null and explain the conflict.
- Never infer a missing amount from another field. For a 2% or 3% withholding, calculate only when the gross amount and exact rate are explicit.
- Service Type: keywords like google, facebook, domain, hosting
- Customer Name: company names or person names (avoid generic words)
- CID: patterns like "CID 1234" or "cid 1234" or explicit service ID numbers
- Withholding: keywords หัก ณ ที่จ่าย, หักนำ, WHT, tax deduction

Be smart about context:
- If message says "ค่าคลิก google 3000" → amount: 3000, serviceType: "google"
- If message says "ลูกค้า xxx cid 5149" → customerName: "xxx", cid: "5149"
- Only extract if confident (80%+)`;

    const userPrompt = `Extract details from this Thai payment message:
"${message}"`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // High accuracy, low randomness
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const rawExtraction = parseJsonResponse(content) || {};

    // Normalize and validate results
    return {
      amount: typeof rawExtraction.amount === 'number' ? rawExtraction.amount : null,
      currency: rawExtraction.currency || 'THB',
      serviceType: validateServiceType(rawExtraction.serviceType),
      customerName: normalizeCustomerName(rawExtraction.customerName),
      cid: normalizeCid(rawExtraction.cid),
      withholding: Boolean(rawExtraction.withholding)
        || /หัก\s*ณ\s*ที่จ่าย|หักนำ|withholding|\bwht\b/i.test(message),
      withholdingRate: [2, 3].includes(Number(rawExtraction.withholdingRate))
        ? Number(rawExtraction.withholdingRate)
        : null,
      withholdingType: ['click', 'service', 'domain'].includes(rawExtraction.withholdingType)
        ? rawExtraction.withholdingType
        : null,
      grossAmount: typeof rawExtraction.grossAmount === 'number' ? rawExtraction.grossAmount : null,
      withholdingAmount: typeof rawExtraction.withholdingAmount === 'number' ? rawExtraction.withholdingAmount : null,
      netAmount: typeof rawExtraction.netAmount === 'number' ? rawExtraction.netAmount : null,
      confidence: Math.min(Math.max(rawExtraction.confidence || 0, 0), 100),
      rawExtraction: rawExtraction
    };
  } catch (error) {
    console.error('[messageDetailExtractor] Error calling OpenAI:', error.message);
    return {
      amount: null,
      currency: 'THB',
      serviceType: null,
      customerName: null,
      cid: null,
      withholding: false,
      withholdingRate: null,
      withholdingType: null,
      grossAmount: null,
      withholdingAmount: null,
      netAmount: null,
      confidence: 0,
      rawExtraction: { error: error.message }
    };
  }
}

/**
 * Normalize service type to standard values
 */
function validateServiceType(serviceType) {
  if (!serviceType) return null;
  
  const normalized = String(serviceType).toLowerCase().trim();
  
  // Map variations to standard types
  if (normalized.includes('google') || normalized.includes('gg')) return 'google';
  if (normalized.includes('facebook') || normalized.includes('fb')) return 'facebook';
  if (normalized.includes('domain') || normalized.includes('hosting') || normalized.includes('web')) return 'domain';
  if (normalized.includes('wht') || normalized.includes('หักนำ')) return 'wht';
  
  return normalized.length > 0 ? normalized : null;
}

/**
 * Normalize customer name (remove generic words, trim)
 */
function normalizeCustomerName(name) {
  if (!name) return null;
  
  const normalized = String(name).trim();
  
  // Filter out generic/placeholder names
  const generic = ['xxx', 'xxxxxx', 'n/a', 'unknown', 'ไม่ระบุ', '-', ''];
  if (generic.includes(normalized.toLowerCase())) return null;
  
  return normalized.length > 0 ? normalized : null;
}

/**
 * Normalize CID (extract just the number/ID)
 */
function normalizeCid(cid) {
  if (!cid) return null;
  
  const cidStr = String(cid).trim();
  
  // Extract numeric part if it contains text
  const match = cidStr.match(/\d+/);
  if (match) return match[0];
  
  return cidStr.length > 0 ? cidStr : null;
}

module.exports = {
  extractMessageDetails,
};
