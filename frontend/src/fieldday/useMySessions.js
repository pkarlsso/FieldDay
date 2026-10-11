import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { loadMySessions } from './sessionInfo';
import logger from '../logger';

// The signed-in user's hosted, joined and completed sessions. Refetched every
// time the screen regains focus, so creating, joining or leaving a session
// elsewhere shows up as soon as the user comes back. `refresh` is for
// pull-to-refresh.
export function useMySessions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(true);

  const fetchSessions = useCallback(async () => {
    try {
      const result = await loadMySessions();
      if (active.current) {
        setData(result);
        setError('');
      }
    } catch (err) {
      logger.error('My sessions fetch error:', err);
      if (active.current) setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    fetchSessions();
    return () => { active.current = false; };
  }, [fetchSessions]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  return { data, error, loading: !data && !error, refreshing, refresh };
}
