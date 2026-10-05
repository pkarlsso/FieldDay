import { Text, TouchableOpacity, View } from 'react-native';
import { Card, SportIcon, StatusBadge } from './ui';
import { colors } from '../theme';
import { formatSessionRange, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';

// One live session in a list, with an optional status badge on the right.
export default function SessionRow({ session, badge, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SportIcon sport={session.sport} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{sessionTitle(session)}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
          <Text style={{ color: colors.text, marginTop: 2 }}>{playersLabel(session)} • {skillLabel(session)}</Text>
        </View>
        {badge ? <StatusBadge {...badge} /> : null}
      </Card>
    </TouchableOpacity>
  );
}
