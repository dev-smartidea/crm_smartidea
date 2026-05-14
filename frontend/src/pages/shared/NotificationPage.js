import React from 'react';
import { Clock, Person, ExclamationCircle } from 'react-bootstrap-icons';
import BaseNotificationPage from '../../components/BaseNotificationPage';

const USER_ICON_MAP = {
  'service_overdue': { icon: ExclamationCircle, color: '#ef4444' },
  'service_due_soon': { icon: Clock, color: '#f59e0b' },
  'new_customer': { icon: Person, color: '#10b981' },
};

export default function NotificationPage() {
  return <BaseNotificationPage iconMap={USER_ICON_MAP} excludeTypes={['new_transaction']} />;
}
