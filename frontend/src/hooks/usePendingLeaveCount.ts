import { useEffect, useState } from 'react';
import api from '../api';

// Shared pending-leave-count polling. Navbar and BottomNav both mount on
// desktop+mobile layouts; a single module-level interval serves every consumer
// so we don't issue duplicate /api/leave-requests polls on one screen.

const POLL_INTERVAL = 30000;

let cachedCount = 0;
let isPolling = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(count: number) => void>();

function publish(count: number) {
  cachedCount = count;
  listeners.forEach((listener) => listener(count));
}

async function checkPending() {
  try {
    const res = await api.get('/api/leave-requests');
    if (!Array.isArray(res.data)) return;
    publish(res.data.filter((r: any) => r.status === 'pending').length);
  } catch {
    publish(0);
  }
}

function startPolling() {
  if (intervalId !== null) return;
  checkPending();
  intervalId = setInterval(checkPending, POLL_INTERVAL);
}

function stopPolling() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  cachedCount = 0;
}

// active=false (non-admin) keeps the component from talking to the API at all.
export function usePendingLeaveCount(active: boolean): number {
  const [count, setCount] = useState(cachedCount);

  useEffect(() => {
    if (!active) return;

    listeners.add(setCount);
    setCount(cachedCount);
    if (!isPolling) {
      isPolling = true;
      startPolling();
    }

    return () => {
      listeners.delete(setCount);
      if (listeners.size === 0 && isPolling) {
        isPolling = false;
        stopPolling();
      }
    };
  }, [active]);

  return count;
}