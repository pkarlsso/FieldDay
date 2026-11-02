/* global describe, expect, it, jest */
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import MapScreen from '../MapScreen';
import { fallbackSport, getSportConfig, sports } from '../../theme';

jest.mock('../../discovery', () => ({
  getDiscoveryOrigin: jest.fn().mockResolvedValue(null),
  loadDiscoverySessions: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');

  return {
    MaterialCommunityIcons: ({ name, color }) => <View testID={`sport-icon-${name}`} color={color} />,
  };
});

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');

  const MapView = ({ children }) => <View testID="map-view">{children}</View>;
  const Marker = ({ children, accessibilityLabel, onPress }) => (
    <View testID={`marker-${accessibilityLabel}`} accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {children}
    </View>
  );
  const Callout = ({ children, accessibilityLabel, onPress }) => (
    <View testID={`callout-${accessibilityLabel}`} accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {children}
    </View>
  );

  return { __esModule: true, default: MapView, Marker, Callout, PROVIDER_GOOGLE: 'google' };
});

describe('sport-specific map markers', () => {
  it('uses the configured icon and color for supported sports and a neutral fallback for unknown sports', () => {
    expect(getSportConfig('Pickleball')).toEqual(sports.Pickleball);
    expect(getSportConfig('Pickleball')).not.toEqual(fallbackSport);
    expect(getSportConfig('Quidditch')).toEqual(fallbackSport);
  });

  it('renders configured sport icons and highlights a selected marker', async () => {
    const screen = render(<MapScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => expect(screen.getByTestId('sport-icon-tennis-ball')).toBeTruthy());
    expect(screen.getByTestId('session-marker-background-Pickleball').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: sports.Pickleball.color }),
    ]));
    expect(screen.getByTestId('session-marker-background-Soccer').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: sports.Soccer.color }),
    ]));

    fireEvent.press(screen.getByTestId('marker-Pickleball session at Hildegard Park'));

    await waitFor(() => {
      const markerOuter = screen.getByTestId('session-marker-Pickleball');
      expect(markerOuter.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining({ borderColor: sports.Pickleball.color, borderWidth: 3 }),
      ]));
    });
  });

  it('opens the selected session details when its callout is pressed', async () => {
    const navigation = { navigate: jest.fn() };
    const screen = render(<MapScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByLabelText('Open Pickleball session details')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Open Pickleball session details'));

    expect(navigation.navigate).toHaveBeenCalledWith('SessionDetails', { sessionId: 's1' });
  });
});
