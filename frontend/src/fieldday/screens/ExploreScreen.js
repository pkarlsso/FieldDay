import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, HeaderActionRow, IconButton, NotificationButton, Pill, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { colors, sports } from '../theme';
import { sessions } from '../data/mockData';

const filters = ['All', 'Pickleball', 'Basketball', 'Soccer', 'Tennis', 'Volleyball'];

function MapPin({ session, selected, onPress }) {
  const config = sports[session.sport] || sports.Pickleball;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        position: 'absolute',
        left: session.coordinates.left,
        top: session.coordinates.top,
        width: selected ? 58 : 42,
        height: selected ? 58 : 42,
        borderRadius: selected ? 29 : 21,
        backgroundColor: selected ? `${config.color}20` : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? config.color : colors.line,
      }}
    >
      <View style={{ width: selected ? 40 : 30, height: selected ? 40 : 30, borderRadius: selected ? 20 : 15, backgroundColor: config.color, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={config.icon} size={selected ? 23 : 17} color={colors.card} />
      </View>
    </TouchableOpacity>
  );
}

export default function ExploreScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('s1');
  const [showFilters, setShowFilters] = useState(false);
  const visibleSessions = useMemo(
    () => sessions.filter((session) => activeFilter === 'All' || session.sport === activeFilter),
    [activeFilter]
  );
  const selected = sessions.find((session) => session.id === selectedId) || visibleSessions[0] || sessions[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Explore"
        right={
          <HeaderActionRow>
            <NotificationButton onPress={() => navigation.navigate('Notifications')} />
            <IconButton
              onPress={() => setShowFilters((value) => !value)}
              icon={showFilters ? 'close' : 'options-outline'}
              color={showFilters ? colors.card : colors.ink}
              backgroundColor={showFilters ? colors.purple : colors.card}
              borderColor={showFilters ? colors.purple : colors.line}
            />
          </HeaderActionRow>
        }
      />
      <View style={{ paddingHorizontal: 18 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {filters.map((filter) => (
            <Pill
              key={filter}
              label={filter}
              active={activeFilter === filter}
              color={filter === 'All' ? colors.purple : sports[filter]?.color || colors.purple}
              onPress={() => {
                setActiveFilter(filter);
                const first = sessions.find((session) => filter === 'All' || session.sport === filter);
                if (first) setSelectedId(first.id);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120, gap: 14 }}>
        <Card style={{ height: 340, padding: 0, overflow: 'hidden', backgroundColor: '#EBEFE9' }}>
          <View style={{ flex: 1 }}>
            <View style={{ position: 'absolute', left: 24, right: 24, top: 76, height: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: 184, height: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', left: 36, right: 76, top: 268, height: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', left: 70, top: 0, bottom: 0, width: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', left: 174, top: 0, bottom: 0, width: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', left: 258, top: 48, bottom: 48, width: 4, backgroundColor: '#FFFFFF' }} />
            <View style={{ position: 'absolute', right: 22, top: 0, bottom: 0, width: 62, backgroundColor: '#BFDFF4', opacity: 0.82 }} />
            <View style={{ position: 'absolute', left: 108, top: 74, width: 128, height: 158, borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#CFE7C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.greenDark, fontWeight: '900', textAlign: 'center' }}>Hildegard{'\n'}Park</Text>
            </View>
            <View style={{ position: 'absolute', left: 26, top: 16, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={14} color={colors.purple} />
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{visibleSessions.length} sessions nearby</Text>
            </View>
            {visibleSessions.map((session) => (
              <MapPin key={session.id} session={session} selected={session.id === selected.id} onPress={() => setSelectedId(session.id)} />
            ))}
            <Card style={{ position: 'absolute', left: 14, right: 14, bottom: 14, padding: 12 }}>
              <TouchableOpacity activeOpacity={0.86} onPress={() => navigation.navigate('SessionDetails', { sessionId: selected.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <SportIcon sport={selected.sport} size={50} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{selected.title}</Text>
                    <Text style={{ color: colors.muted, marginTop: 4 }}>{selected.date} • {selected.time}</Text>
                  </View>
                  <StatusBadge label={selected.distance} icon="navigate" color={colors.green} />
                </View>
              </TouchableOpacity>
            </Card>
          </View>
        </Card>

        {showFilters ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Filters</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text }}>Distance</Text>
              <Text style={{ color: colors.purple, fontWeight: '900' }}>Within 10 mi</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text }}>Skill level</Text>
              <Text style={{ color: colors.purple, fontWeight: '900' }}>2.0 - 4.0</Text>
            </View>
          </Card>
        ) : null}

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 4 }}>Nearby Sessions</Text>
        {visibleSessions.map((session) => (
          <TouchableOpacity key={session.id} activeOpacity={0.88} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <SportIcon sport={session.sport} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{session.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{session.date} • {session.joined}/{session.maxParticipants} members</Text>
              </View>
              <Text style={{ color: colors.muted }}>{session.distance}</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
