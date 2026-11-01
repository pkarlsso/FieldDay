// Local web-only stand-in for react-native-maps (native-only package).
import { Text, View } from 'react-native';

export default function MapView({ style }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB', minHeight: 160 }, style]}>
      <Text style={{ color: '#6B7280' }}>Map preview not available on web</Text>
    </View>
  );
}
export const Marker = () => null;
export const Callout = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;
