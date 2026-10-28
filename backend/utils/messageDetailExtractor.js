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
  "withholding": boolean (true if message mentions หักนำ, WHT, tax deduction),
  "confidence": number (0-100),
  "extractionNotes": "explanation of extraction"
}

Service Type Indicators:
- "google" or "gg" → Google Ads (ค่าคลิก google, google ads)
- "facebook" or "fb" → Facebook Ads (ค่าคลิก facebook, facebook ads)
- "domain" or "hosting" or "web" → Domain/Hosting services
- "wht" or "หักนำ" or "tax deduction" → Withholding tax (also set withholding: true)

Extract from these patterns:
- Amount: numbers + baht (บาท, ฿, THB)
- Service Type: keywords like google, facebook, domain, hosting
- Customer Name: company names or person names (avoid generic words)
- CID: patterns like "CID 1234" or "cid 1234" or explicit service ID numbers
- Withholding: keywords หักนำ, WHT, tax deduction

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
      withholding: Boolean(rawExtraction.withholding),
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
