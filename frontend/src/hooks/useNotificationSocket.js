import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function useNotificationSocket(onNotification, enabled = true) {
  const callbackRef = useRef(onNotification);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token },
    });
    
    socket.on('notification', (data) => {
      if (typeof callbackRef.current === 'function') {
        callbackRef.current(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]); // Only connect once when enabled
}
