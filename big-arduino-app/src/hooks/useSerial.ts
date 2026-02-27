import { useState, useCallback, useEffect } from 'react';
import { serialService } from '../services/serial';

interface UseSerialReturn {
  isConnected: boolean;
  isSupported: boolean;
  error: string | null;
  lastMessage: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (data: string) => Promise<void>;
}

export function useSerial(): UseSerialReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState('');
  const isSupported = serialService.isSupported();

  useEffect(() => {
    // Set up data callback
    serialService.onData((data) => {
      setLastMessage(prev => prev + data);
    });

    return () => {
      // Cleanup on unmount
      if (serialService.isConnected()) {
        serialService.disconnect();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await serialService.connect(9600);
      setIsConnected(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await serialService.disconnect();
      setIsConnected(false);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Disconnect failed';
      setError(message);
    }
  }, []);

  const send = useCallback(async (data: string) => {
    try {
      await serialService.send(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      setError(message);
    }
  }, []);

  return {
    isConnected,
    isSupported,
    error,
    lastMessage,
    connect,
    disconnect,
    send,
  };
}
