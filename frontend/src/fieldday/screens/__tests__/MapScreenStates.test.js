/* global afterEach, beforeEach, describe, expect, it, jest */
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import MapScreen from '../MapScreen';
import { getDiscoveryOrigin, loadDiscoverySessions } from '../../discovery';

jest.mock('../../discovery', () => ({
  getDiscoveryOrigin: jest.fn(),
  loadDiscoverySessions: jest.fn(),
}));

jest.mock('../../../logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { MaterialCommunityIcons: () => <View /> };
});

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = ({ children }) => <View testID="map-view">{children}</View>;
  const Marker = ({ children, accessibilityLabel }) => <View accessibilityLabel={accessibilityLabel}>{children}</View>;
  const Callout = ({ children }) => <View>{children}</View>;
  return { __esModule: true, default: MapView, Marker, Callout, PROVIDER_GOOGLE: 'google' };
});

const liveSession = {
  id: 'session-1',
  sport: 'Pickleball',
  startsAt: '2026-11-02T18:00:00.000Z',
  location: 'Hildegard Park',
  locationPoint: { coordinates: [-86.9212, 40.4237] },
};

describe('MapScreen live-data states', () => {
  const originalLiveData = process.env.EXPO_PUBLIC_LIVE_DATA;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_LIVE_DATA = 'true';
    getDiscoveryOrigin.mockResolvedValue(null);
    loadDiscoverySessions.mockReset();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_LIVE_DATA = originalLiveData;
  });

  it('shows a loading state while nearby sessions are requested', () => {
    getDiscoveryOrigin.mockReturnValue(new Promise(() => {}));
    loadDiscoverySessions.mockReturnValue(new Promise(() => {}));
    const screen = render(<MapScreen navigation={{ navigate: jest.fn() }} />);

    expect(screen.getByText('Loading map sessions…')).toBeTruthy();
  });

  it('shows an empty state when the live session response is empty', async () => {
    loadDiscoverySessions.mockResolvedValue([]);
    const screen = render(<MapScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => expect(screen.getByText('No sessions are available nearby.')).toBeTruthy());
  });

  it('shows an error and loads markers after a successful retry', async () => {
    loadDiscoverySessions
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([liveSession]);
    const screen = render(<MapScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => expect(screen.getByText('Nearby sessions could not be loaded. Try again.')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Retry map loading' }));

    await waitFor(() => expect(loadDiscoverySessions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('Pickleball session at Hildegard Park')).toBeTruthy());
    expect(screen.queryByText('Nearby sessions could not be loaded. Try again.')).toBeNull();
  });
});
