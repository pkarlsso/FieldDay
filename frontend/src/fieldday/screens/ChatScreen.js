import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';
import { GET_CONVERSATIONS } from '../../graphql/queries';
import { Avatar, Card, NotificationButton, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { formatSessionRange, playersLabel, sessionTitle } from '../sessionInfo';
import { colors } from '../theme';

const statusBadges = {
  upcoming: { label: 'Upcoming', icon: 'calendar-outline', color: colors.purple },
  in_progress: { label: 'Happening now', icon: 'play-circle-outline', color: colors.gold },
  completed: { label: 'Ended', icon: 'checkmark-done', color: colors.green },
};

// Sessions still to come (or under way) come first, soonest at the top; ended
// ones follow in the server's most-recent-activity order.
function sortSessionChats(conversations) {
  const active = conversations.filter(({ session }) => session && session.status !== 'completed')
    .sort((a, b) => new Date(a.session.startsAt) - new Date(b.session.startsAt));
  const ended = conversations.filter((conversation) => !active.includes(conversation));
  return [...active, ...ended];
}

function lastMessagePreview(conversation) {
  const last = conversation.messages[0];
  if (!last) return 'No messages yet';
  if (last.mine) return `You: ${last.body}`;
  return conversation.kind === 'session' ? `${last.sender.name.split(' ')[0]}: ${last.body}` : last.body;
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.card, fontWeight: '900' }}>{count}</Text>
    </View>
  );
}

function SectionHeader({ title, count }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: colors.muted, fontWeight: '800' }}>{count}</Text>
    </View>
  );
}

function SessionChatRow({ conversation, onPress }) {
  const { session } = conversation;
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {session ? <SportIcon sport={session.sport} size={48} /> : <Avatar name={conversation.name} color={colors.purple} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>
              {session ? sessionTitle(session) : conversation.name}
            </Text>
            {session ? (
              <>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
                <Text style={{ color: colors.text, marginTop: 2 }}>{playersLabel(session)}</Text>
              </>
            ) : null}
          </View>
          <UnreadBadge count={conversation.unreadCount} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {session ? <StatusBadge {...(statusBadges[session.status] || statusBadges.upcoming)} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, color: colors.muted }}>{lastMessagePreview(conversation)}</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function DirectChatRow({ conversation, onPress }) {
  const friend = conversation.participants.find((participant) => participant.id !== CURRENT_USER_ID);
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={conversation.name} uri={friend?.profilePicture} color={colors.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{conversation.name}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>{lastMessagePreview(conversation)}</Text>
        </View>
        <UnreadBadge count={conversation.unreadCount} />
        <Ionicons name="chevron-forward" size={19} color={colors.muted} />
      </Card>
    </TouchableOpacity>
  );
}

export default function ChatScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConversations = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    graphql(GET_CONVERSATIONS)
      .then((data) => { if (active) setConversations(data.getConversations || []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => loadConversations(), [loadConversations]));

  const sessionChats = sortSessionChats(conversations.filter(({ kind }) => kind === 'session'));
  const directChats = conversations.filter(({ kind }) => kind === 'direct');
  const open = (conversation) => navigation.navigate('ChatDetail', { conversationId: conversation.id });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Chat" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 12 }}>
        {loading && conversations.length === 0 ? <ActivityIndicator color={colors.purple} /> : null}
        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}

        {!error ? (
          <>
            <SectionHeader title="Sessions" count={sessionChats.length} />
            {sessionChats.length === 0 && !loading ? (
              <Card><Text style={{ color: colors.muted }}>Join or host a session to chat with its players.</Text></Card>
            ) : null}
            {sessionChats.map((conversation) => (
              <SessionChatRow key={conversation.id} conversation={conversation} onPress={() => open(conversation)} />
            ))}

            <SectionHeader title="Direct messages" count={directChats.length} />
            {directChats.length === 0 && !loading ? (
              <Card><Text style={{ color: colors.muted }}>Tap a friend on the Friends tab to start a conversation.</Text></Card>
            ) : null}
            {directChats.map((conversation) => (
              <DirectChatRow key={conversation.id} conversation={conversation} onPress={() => open(conversation)} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
