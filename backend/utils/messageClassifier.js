const OpenAI = require('openai');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getRecentTopupExamples(limit = 6) {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return '';
    }

    const transactions = await Transaction.find({
      amount: { $gt: 0 },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const examples = transactions
      .map((tx) => {
        const note = String(tx.notes || '').replace(/\s+/g, ' ').trim();
        if (!note) return null;
        return `- "${note}" -> topup request`;
      })
      .filter(Boolean);

    if (!examples.length) {
      return '';
    }

    return `
Recent topup examples already in CRM:
${examples.join('\n')}
`;
  } catch (error) {
    console.warn('[messageClassifier] Could not load recent topup examples:', error.message);
    return '';
  }
}

function heuristicClassifyTopupRequest(message) {
  const text = String(message || '').toLowerCase();
  if (!text) {
    return null;
  }

  const hasAmount = /(\d[\d,]*(\.?\d+)?\s*(บาท|฿|thb|bht)|\b\d{2,}(?:[.,]\d{2})?\b)/.test(text);
  const hasServiceKeyword = /(ค่าบริการ|ค่าแอด|ค่าโฆษณา|ค่าใช้จ่าย|ค่าคลิก|topup|top up|service fee|advertising|ads|การโอน|โอนเงิน|จ่ายเงิน|ชำระ|ราคานี้|ยอดเงิน|ค่าเปิด|ค่า setup|ค่าโดเมน|ค่าบริการโดเมน)/.test(text);
  const hasRequestKeyword = /(ขอ|อยาก|please|กรุณา|โอน|จ่าย|ชำระ|เติม|pay|transfer)/.test(text);
  const hasCid = /(?:cid|บัญชี)\s*[:\-]?\s*\d+/.test(text);
  const hasDomain = /(www\.|\.com|\.co\.|domain|website|เว็บ|site)/.test(text);
  const mentionsPersonalShopping = /(ซื้อ|ขนม|เซเว่น|ร้าน|อาหาร|ตลาด|มือถือ|เติมเงินมือถือ|ไปซื้อ|ซื้อของ)/.test(text);
  const explicitBusinessContext = hasCid || hasDomain || hasServiceKeyword;

  if (mentionsPersonalShopping && !explicitBusinessContext) {
    return {
      isTopupRequest: false,
      confidence: 10,
      reason: 'General personal shopping or small personal spending is not a business topup request.',
    };
  }

  if (hasAmount && hasServiceKeyword && (hasRequestKeyword || text.includes('ค่า'))) {
    return {
      isTopupRequest: true,
      confidence: 80,
      reason: 'Detected invoice/service-fee amount pattern consistent with a payment request.',
    };
  }

  if (hasCid && hasDomain && hasServiceKeyword) {
    return {
      isTopupRequest: true,
      confidence: 75,
      reason: 'Detected a customer/service record with a website and service cost, which matches a topup request pattern.',
    };
  }

  if ((text.includes('เติมเงิน') || text.includes('topup')) && explicitBusinessContext) {
    return {
      isTopupRequest: true,
      confidence: 75,
      reason: 'Detected explicit top-up wording tied to a business/service context.',
    };
  }

  return null;
}

/**
 * จำแนกข้อความว่าเป็น topup request หรือไม่
 * @param {string} message - ข้อความจาก LINE
 * @param {string} displayName - ชื่อผู้ส่ง (optional)
 * @returns {Promise<{isTopupRequest: boolean, confidence: number, reason: string}>}
 */
async function classifyTopupRequest(message, displayName = 'Unknown') {
  try {
    const heuristic = heuristicClassifyTopupRequest(message);
    if (heuristic) {
      return heuristic;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('[messageClassifier] OPENAI_API_KEY not set. Defaulting to false.');
      return {
        isTopupRequest: false,
        confidence: 0,
        reason: 'OPENAI_API_KEY not configured',
      };
    }

    const historicalExamples = await getRecentTopupExamples();

    const systemPrompt = `You are a LINE group message classifier specialized in identifying only business-related topup requests.

ภารกิจของคุณ: เลือกเฉพาะข้อความที่เกี่ยวข้องกับคำขอเติมเงิน/โอนเงินสำหรับธุรกิจเท่านั้น เพื่อใช้ใน CRM tracking

ข้อความที่ถือว่าเป็น topup request ที่ถูกต้องมักมีสัญญาณด้านธุรกิจอย่างน้อยหนึ่งอย่าง เช่น:
- มีเลขหรือข้อมูลลูกค้า/บริการ เช่น CID, customer name, account, project name
- มีคำที่เกี่ยวกับบริการ เช่น ค่าบริการ, ค่าแอด, ค่าคลิก, ค่าโฆษณา, domain, website, ad spend, service fee
- มีคำสั่งชัดเจนเรื่องการชำระเงิน เช่น โอน, จ่าย, เติมเงิน, topup, transfer, remit
- เป็นบริบทธุรกิจ/เอเจนซี่ ไม่ใช่ค่าใช้จ่ายส่วนตัวหรือชีวิตประจำวัน

ไม่ควรจัดว่าเป็น topup request:
- ค่าใช้จ่ายส่วนตัว เช่น ซื้อขนม, ซื้ออาหาร, เซเว่น, เติมเงินมือถือ, ค่าน้ำมัน, ค่ารถ
- การสนทนาแบบทั่วไป, การพูดแซว, หรือข้อความที่มีตัวเลขแต่ไม่มีเจตนาธุรกิจ
- ข้อความที่มีแค่ตัวเลขหรือค่าใช้จ่าย แต่ไม่มีบริบทธุรกิจ/การชำระเงิน
- ข้อความเกี่ยวกับการเติมเงินมือถือส่วนตัว, ค่าครองชีพ หรือค่าใช้จ่ายทั่วไป

ใช้ข้อมูลประวัติจาก CRM ด้านล่างเป็นตัวอย่างของรูปแบบคำขอเติมเงินจริงๆ เท่านั้น หากข้อความไม่เหมือนรูปแบบธุรกิจ/บริการ ให้ปฏิเสธ

ตอบในรูปแบบ JSON เท่านั้น:
{
  "isTopupRequest": boolean,
  "confidence": number (0-100),
  "reason": "คำอธิบายสั้น"
}

สิ่งสำคัญ: ต้องระมัดระวังมาก ให้เลือกเฉพาะที่แน่ใจจริงๆ หากไม่แน่ใจ ให้คืนค่า false

${historicalExamples}`;

    const userPrompt = `Classify this message from "${displayName}":
"${message}"`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using faster/cheaper mini model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for consistent classification
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    return {
      isTopupRequest: result.isTopupRequest === true,
      confidence: Math.min(result.confidence || 0, 100),
      reason: result.reason || 'No reason provided',
    };
  } catch (error) {
    console.error('[messageClassifier] Error calling OpenAI:', error.message);
    return {
      isTopupRequest: false,
      confidence: 0,
      reason: `Error: ${error.message}`,
    };
  }
}

module.exports = {
  classifyTopupRequest,
};
