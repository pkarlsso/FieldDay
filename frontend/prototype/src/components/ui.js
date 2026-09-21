import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadow, sports } from '../theme';

export function ScreenHeader({ eyebrow, title, subtitle, left, right }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.page }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {left}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={{ color: colors.purple, fontWeight: '800', fontSize: 12, letterSpacing: 0 }}>{eyebrow}</Text> : null}
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 4 }}>{title}</Text>
          {subtitle ? <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function Card({ children, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 20,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.line,
          padding: 16,
          ...shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Pill({ label, active, color = colors.purple, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? color : colors.card,
        borderWidth: 1,
        borderColor: active ? color : colors.line,
      }}
    >
      <Text style={{ color: active ? colors.card : colors.text, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SportIcon({ sport, size = 52 }) {
  const config = sports[sport] || { icon: 'run-fast', color: colors.purple };
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        borderCurve: 'continuous',
        backgroundColor: config.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={config.icon} size={Math.round(size * 0.52)} color={colors.card} />
    </View>
  );
}

export function Stat({ value, label, color = colors.purple, labelColor = colors.muted }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: labelColor, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, variant = 'primary', disabled, icon }) {
  const primary = variant === 'primary';
  const destructive = variant === 'destructive';
  const accent = destructive ? colors.coral : colors.purple;
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: primary ? colors.purple : colors.card,
        borderWidth: 1.2,
        borderColor: primary ? colors.purple : accent,
        borderRadius: 16,
        borderCurve: 'continuous',
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? colors.card : accent} /> : null}
      <Text style={{ color: primary ? colors.card : accent, fontWeight: '900', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function HeaderActionRow({ children }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>{children}</View>;
}

export function NotificationButton({ onPress, count = 2 }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        width: 42,
        height: 42,
        borderRadius: 15,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="notifications-outline" size={20} color={colors.ink} />
      {count ? (
        <View
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            minWidth: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: colors.coral,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.card,
          }}
        >
          <Text style={{ color: colors.card, fontWeight: '900', fontSize: 9 }}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function Avatar({ name, size = 44, color = colors.purple }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.card, fontWeight: '900', fontSize: Math.max(12, size * 0.34) }}>{initials}</Text>
    </View>
  );
}

export function IconButton({ icon, onPress, color = colors.ink, backgroundColor = colors.card, borderColor = colors.line }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        width: 42,
        height: 42,
        borderRadius: 15,
        borderCurve: 'continuous',
        backgroundColor,
        borderWidth: 1,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

export function StatusBadge({ label, icon = 'checkmark-circle', color = colors.green }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${color}18`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '900' }}>{label}</Text>
    </View>
  );
}
