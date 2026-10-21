/**
 * Slip detail extractor using Thunder API with fallback
 */

const getFirst = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

/**
 * Extract details from bank slip buffer (Amount, Date, Time, Bank)
 * @param {Buffer} imageBuffer - Slip image buffer
 * @returns {Promise<{
 *   success: boolean,
 *   amount: number|null,
 *   bank: string|null,
 *   transDate: string|null,
 *   transTime: string|null,
 *   raw?: any
 * }>}
 */
async function extractSlipDetails(imageBuffer) {
  if (!imageBuffer) {
    return { success: false, amount: null, bank: null, transDate: null, transTime: null };
  }

  // 1. Try Thunder API first
  const THUNDER_API_KEY = process.env.THUNDER_API_KEY;
  const THUNDER_API_URL = process.env.THUNDER_API_URL || 'https://api.thunder.in.th/v1/verify';

  if (THUNDER_API_KEY) {
    try {
      console.log('[slipExtractor] Attempting extraction via Thunder API...');
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.set('file', blob, 'slip.jpg');

      const response = await fetch(THUNDER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${THUNDER_API_KEY}`,
          'x-api-key': THUNDER_API_KEY,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && (result.success || result.status === 200)) {
        const data = result.data || result.result || result;
        let transDate = '';
        let transTime = '';

        const dateVal = getFirst(data.transDate, data.transactionDate, data.date, data.datetime, data.transDateTime);
        if (dateVal) {
          try {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
              const localDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
              const isoString = localDate.toISOString();
              transDate = isoString.split('T')[0];
              const matchTime = isoString.split('T')[1].substring(0, 5);
              transTime = matchTime.replace(':', '');
            }
          } catch (e) {
            transDate = String(dateVal).split('T')[0];
          }
        }

        const timeVal = getFirst(data.transTime, data.transactionTime, data.time);
        if (!transTime && timeVal) {
          transTime = String(timeVal).substring(0, 5).replace(':', '');
        }

        const receiverBank = getFirst(
          data.receiver?.bank?.short,
          data.receiver?.bank?.name,
          data.receiver?.bank?.code,
          data.receiverBank,
          data.receiver_bank,
          data.receivingBank,
          ''
        );

        const amountValue = getFirst(data.amount, data.transAmount, data.transactionAmount, data.totalAmount);
        const rawAmount = typeof amountValue === 'object'
          ? getFirst(amountValue.amount, amountValue.value)
          : amountValue;

        const numAmount = rawAmount ? parseFloat(String(rawAmount).replace(/,/g, '')) : null;

        console.log(`[slipExtractor] ✅ Thunder API extracted: Amount=${numAmount}, Date=${transDate}, Bank=${receiverBank}`);
        return {
          success: true,
          amount: !isNaN(numAmount) ? numAmount : null,
          bank: receiverBank || null,
          transDate: transDate || null,
          transTime: transTime || null,
          raw: data,
        };
      } else {
        console.log(`[slipExtractor] Thunder API verification not successful (${result?.message || result?.error || response.status}), trying fallback...`);
      }
    } catch (thunderErr) {
      console.warn('[slipExtractor] Thunder API error:', thunderErr.message);
    }
  }

  // 2. Fallback to OpenAI Vision if API key is present and not dummy
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (OPENAI_API_KEY && !OPENAI_API_KEY.includes('xxxx') && OPENAI_API_KEY.startsWith('sk-')) {
    try {
      console.log('[slipExtractor] Attempting extraction via OpenAI Vision...');
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey: OPENAI_API_KEY });
      const base64 = imageBuffer.toString('base64');

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this Thai payment/transfer slip receipt. Extract JSON:
{
  "amount": number or null,
  "transDate": "YYYY-MM-DD" or null,
  "transTime": "HH:mm" or null,
  "bank": "KBANK" | "SCB" | "BBL" | "KTB" | "TTB" | "BAY" or other,
  "confidence": number (0-100)
}
Return only JSON.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      console.log(`[slipExtractor] ✅ OpenAI Vision extracted: Amount=${parsed.amount}, Bank=${parsed.bank}`);
      return {
        success: Boolean(parsed.amount),
        amount: parsed.amount || null,
        bank: parsed.bank || null,
        transDate: parsed.transDate || null,
        transTime: parsed.transTime ? String(parsed.transTime).replace(':', '') : null,
        raw: parsed,
      };
    } catch (visionErr) {
      console.warn('[slipExtractor] OpenAI Vision error:', visionErr.message);
    }
  }

  return {
    success: false,
    amount: null,
    bank: null,
    transDate: null,
    transTime: null,
  };
}

module.exports = {
  extractSlipDetails,
};
