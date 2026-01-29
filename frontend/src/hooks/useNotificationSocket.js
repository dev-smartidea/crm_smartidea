import { useEffect } from 'react';
import { io } from 'socket.io-client';

export default function useNotificationSocket(onNotification) {
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    socket.on('notification', (data) => {
      if (typeof onNotification === 'function') onNotification(data);
    });
    return () => {
      socket.disconnect();
    };
  }, [onNotification]);
}
