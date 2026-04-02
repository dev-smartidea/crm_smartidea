import React from 'react';
import { Clock, Person, CurrencyDollar, ExclamationCircle } from 'react-bootstrap-icons';
import BaseNotificationPage from '../../components/BaseNotificationPage';

const USER_ICON_MAP = {
  'service_overdue': { icon: ExclamationCircle, color: '#ef4444' },
  'service_due_soon': { icon: Clock, color: '#f59e0b' },
  'new_customer': { icon: Person, color: '#10b981' },
  'new_transaction': { icon: CurrencyDollar, color: '#3b82f6' }
};

export default function NotificationPage() {
  return <BaseNotificationPage iconMap={USER_ICON_MAP} />;
}
