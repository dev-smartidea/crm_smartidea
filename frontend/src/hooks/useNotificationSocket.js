import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function useNotificationSocket(onNotification) {
  const callbackRef = useRef(onNotification);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    
    socket.on('notification', (data) => {
      if (typeof callbackRef.current === 'function') {
        callbackRef.current(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Only connect once
}
