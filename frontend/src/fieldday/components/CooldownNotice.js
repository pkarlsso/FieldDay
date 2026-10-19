import { Text, View } from 'react-native';
import { Card, StatusBadge } from './ui';
import { colors } from '../theme';
import { formatSessionTime } from '../sessionInfo';

// True while a cooldownUntil from the server (ISO string) is still in the future.
export function isCoolingDown(cooldownUntil) {
  return Boolean(cooldownUntil) && new Date(cooldownUntil) > new Date();
}

// The account suspension notice (FR-8, issue #47) shown in place of the create
// and join actions while the user is in a cooldown.
export default function CooldownNotice({ until }) {
  if (!isCoolingDown(until)) return null;
  return (
    <Card style={{ gap: 8, borderColor: colors.coral, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row' }}>
        <StatusBadge label="Account on cooldown" icon="lock-closed-outline" color={colors.coral} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>
        You can&apos;t create or join sessions right now
      </Text>
      <Text style={{ color: colors.text, lineHeight: 20 }}>
        Your social rating dropped below 2, so your account is on a 2-day cooldown. You can create and join sessions again after {formatSessionTime(until)}.
      </Text>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        Sessions you already joined aren&apos;t affected, and you can still leave them and rate other players.
      </Text>
    </Card>
  );
}
