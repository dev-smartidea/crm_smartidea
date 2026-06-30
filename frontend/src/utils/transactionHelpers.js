// Shared utility functions for transaction-related pages
// Used by: AccountTransactionsPage, ApprovedTransactionsPage, RejectedTransactionsPage,
//          AccountCardDailySummaryPage, AccountLedgerPage

// Constants
export const TRANSACTION_PAGE_SIZE = 6;
export const TRANSACTION_API_LIMIT = 500;
export const MAX_SLIP_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

export const formatNumber = (amount) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Merged from all 3 transaction pages — includes all bank codes
export const getBankBadgeClass = (bank) => {
  const bankMap = {
    'KBANK': 'badge-bank-kbank',
    'SCB': 'badge-bank-scb',
    'BBL': 'badge-bank-bbl',
    'KTB': 'badge-bank-ktb',
    'TTB': 'badge-bank-ttb',
    'BAY': 'badge-bank-bay',
    'BAY-4396': 'badge-bank-bay',
    'BAY-7146': 'badge-bank-bay',
    'Cr.-8508': 'badge-bank',
    'BBL-ส่วนตัว': 'badge-bank-bbl'
  };
  return bankMap[bank] || 'badge-bank';
};

export const getBankName = (bank) => {
  return bank || '-';
};

export const getBreakdownLabel = (code) => {
  const labels = {
    '9': 'หัก ณ ที่จ่าย 2% ค่าคลิก',
    '10': 'หัก ณ ที่จ่าย 3% ค่าบริการ',
    '11': 'ค่าคลิก',
    '12': 'Vat ค่าคลิก',
    '13': 'Vat ค่าบริการ Google',
    '14': 'ค่าบริการ Google',
    '15': 'ค่าบริการบางส่วน',
    '16': 'คูปอง Google',
    '17': 'Vat ค่าบริการ Facebook',
    '18': 'ค่าบริการ Facebook',
    '19': 'Vat ค่าบริการ Hosting Domain',
    '20': 'ค่าบริการ Hosting Domain'
  };
  return labels[code] || code;
};
