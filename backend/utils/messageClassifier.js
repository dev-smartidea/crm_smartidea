const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * จำแนกข้อความว่าเป็น topup request หรือไม่
 * @param {string} message - ข้อความจาก LINE
 * @param {string} displayName - ชื่อผู้ส่ง (optional)
 * @returns {Promise<{isTopupRequest: boolean, confidence: number, reason: string}>}
 */
async function classifyTopupRequest(message, displayName = 'Unknown') {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[messageClassifier] OPENAI_API_KEY not set. Defaulting to false.');
      return {
        isTopupRequest: false,
        confidence: 0,
        reason: 'OPENAI_API_KEY not configured',
      };
    }

    const systemPrompt = `You are a LINE group message classifier specialized in identifying topup requests.

Your task: Analyze the message and determine if it's a topup request (โอนเงิน, ขอโอน, ขอจ่าย, topup, top up, etc.)

Respond in JSON format:
{
  "isTopupRequest": boolean,
  "confidence": number (0-100),
  "reason": "brief explanation"
}

Consider these signs of a topup request:
- Mentions money transfer, payment, or topup
- References amounts or prices
- Contains slang like โอน, ขอ, ประมาณ, ประมาณเท่าไร
- Contains bank names or payment methods
- Contains receipt images or payment proof
- Contains keywords: โอนเงิน, ขอโอน, ขอจ่าย, topup, top up, ส่ง, เงิน, บาท, ฿

Important: Be strict - only return true for CLEAR topup requests, not general chat.`;

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
