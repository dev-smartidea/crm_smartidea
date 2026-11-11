const { parseLinePaymentBreakdown } = require('./linePaymentBreakdown');

const CARD_ADMIN_CRM_USER_ID = '6aed34fdfe6fdbd73573fd03';

function amountMatches(a, b, tolerance = 0.02) {
  const aNum = Number(a);
  const bNum = Number(b);
  return Number.isFinite(aNum) && Number.isFinite(bNum) && Math.abs(aNum - bNum) <= tolerance;
}

function canPairTextAndSlip({ crmUserId, messageText, textAmount, slipAmount, serviceType }) {
  if (slipAmount === null || slipAmount === undefined) return false;

  if (crmUserId === CARD_ADMIN_CRM_USER_ID) {
    const breakdown = parseLinePaymentBreakdown({ messageText, serviceType, slipAmount });
    if (breakdown.valid) return true;
    if (breakdown.declared) {
      return textAmount !== null
        && textAmount !== undefined
        && amountMatches(textAmount, slipAmount);
    }
  }

  return textAmount !== null
    && textAmount !== undefined
    && amountMatches(textAmount, slipAmount);
}

function findUniquePendingMatch(events, matcher) {
  const matchingIndexes = [];
  for (let index = 0; index < events.length; index += 1) {
    if (matcher(events[index])) matchingIndexes.push(index);
  }

  if (matchingIndexes.length !== 1) {
    return {
      event: null,
      ambiguous: matchingIndexes.length > 1,
    };
  }

  const [index] = matchingIndexes;
  return {
    event: events.splice(index, 1)[0],
    ambiguous: false,
  };
}

module.exports = {
  canPairTextAndSlip,
  findUniquePendingMatch,
};
