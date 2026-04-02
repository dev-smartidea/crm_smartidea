import React from 'react';
import { ExclamationCircle, CashCoin, CreditCard2BackFill } from 'react-bootstrap-icons';
import BaseNotificationPage from '../../components/BaseNotificationPage';

const ACCOUNT_ICON_MAP = {
  'card_low_balance': { icon: ExclamationCircle, color: '#f59e0b' },
  'card_inactive': { icon: CreditCard2BackFill, color: '#ef4444' },
  'card_active': { icon: CreditCard2BackFill, color: '#10b981' },
  'transaction_success': { icon: CashCoin, color: '#3b82f6' },
  'transaction_failed': { icon: ExclamationCircle, color: '#ef4444' }
};

const handleClick = (notif, navigate) => {
  if (notif.link) {
    navigate(notif.link);
  } else if (notif.type === 'transaction_success') {
    navigate('/dashboard/account/alltransactions');
  } else if (notif.type?.startsWith('card_')) {
    navigate('/dashboard/account/cards');
  }
};

export default function AccountNotificationPage() {
  return (
    <BaseNotificationPage
      iconMap={ACCOUNT_ICON_MAP}
      onNotificationClick={handleClick}
      socketEnabled
      toastEnabled
    />
  );
}
