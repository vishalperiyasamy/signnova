// Simple auth client for demo purposes
import { useState, useEffect } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
};

type Session = {
  user: User | null;
};

export function useSession() {
  const [data, setData] = useState<Session>({ user: null });
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    // Simulate authentication check
    const checkAuth = async () => {
      try {
        // For demo purposes, always consider the user as authenticated
        const demoUser = {
          id: 'demo-user-id',
          name: 'Demo User',
          email: 'demo@example.com',
        };
        
        setData({ user: demoUser });
        // Store a demo token
        localStorage.setItem('bearer_token', 'demo-token');
      } catch (error) {
        console.error('Auth error:', error);
        setData({ user: null });
      } finally {
        setIsPending(false);
      }
    };

    checkAuth();
  }, []);

  return { data, isPending };
}