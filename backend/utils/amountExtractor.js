const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract amount from topup message using OpenAI
 * @param {string} message - Message text from LINE
 * @returns {Promise<{amount: number|null, currency: string, confidence: number, rawText: string}>}
 */
async function extractAmount(message) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[amountExtractor] OPENAI_API_KEY not set.');
      return {
        amount: null,
        currency: 'THB',
        confidence: 0,
        rawText: '',
        error: 'OPENAI_API_KEY not configured',
      };
    }

    const systemPrompt = `You are an expert at extracting payment amounts from Thai messages.

Your task: Extract the numeric amount and currency from the message.

Respond in JSON format:
{
  "amount": number or null,
  "currency": "THB" or other,
  "confidence": number (0-100),
  "rawText": "the extracted text as it appears"
}

Important:
- Look for numbers like: 100, 1000, 5000, ห้าร้อย (500), หนึ่งพัน (1000)
- Support Thai numerals and English numerals
- Support text numbers in Thai
- Assume default currency is THB (บาท)
- Be strict: only extract clear amounts, not estimates
- Return null if no clear amount found
- confidence: 0-100 (100 = very sure, 0 = not found)`;

    const userPrompt = `Extract amount from this message:
"${message}"`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    return {
      amount: result.amount || null,
      currency: result.currency || 'THB',
      confidence: Math.min(result.confidence || 0, 100),
      rawText: result.rawText || '',
    };
  } catch (error) {
    console.error('[amountExtractor] Error calling OpenAI:', error.message);
    return {
      amount: null,
      currency: 'THB',
      confidence: 0,
      rawText: '',
      error: error.message,
    };
  }
}

module.exports = {
  extractAmount,
};
