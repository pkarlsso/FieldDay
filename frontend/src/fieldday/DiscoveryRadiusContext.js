import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_DISCOVERY_RADIUS_MILES, normalizeDiscoveryRadius } from './discoveryFilters';

const DiscoveryRadiusContext = createContext(null);

export function DiscoveryRadiusProvider({ children }) {
  const [radiusMiles, setRadiusState] = useState(DEFAULT_DISCOVERY_RADIUS_MILES);
  const value = useMemo(() => ({
    radiusMiles,
    setRadiusMiles: (value) => setRadiusState(normalizeDiscoveryRadius(value)),
    resetRadiusMiles: () => setRadiusState(DEFAULT_DISCOVERY_RADIUS_MILES),
  }), [radiusMiles]);

  return <DiscoveryRadiusContext.Provider value={value}>{children}</DiscoveryRadiusContext.Provider>;
}

export function useDiscoveryRadius() {
  const value = useContext(DiscoveryRadiusContext);
  if (!value) throw new Error('useDiscoveryRadius must be used within DiscoveryRadiusProvider');
  return value;
}
