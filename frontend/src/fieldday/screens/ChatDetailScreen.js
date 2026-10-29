import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Card, IconButton, NotificationButton, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { formatSessionRange, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';
import { colors } from '../theme';
import { graphql } from '../../api';
import { getAuthToken } from '../../authToken';
import { API_URL, CURRENT_USER_ID } from '../../config';
import { GET_CONVERSATION, GET_CONVERSATION_MESSAGES, MARK_CONVERSATION_READ, SEND_MESSAGE } from '../../graphql/queries';
import { io } from 'socket.io-client';

// The sender's own socket also receives each message, often before the
// sendMessage response, so messages are merged by id rather than appended.
function addMessage(current, conversationId, message) {
  const messages = current?.messages || [];
  if (messages.some((existing) => existing.id === message.id)) return current;
  return { ...(current || { id: conversationId, name: 'Chat' }), messages: [...messages, message] };
}

const statusBadges = {
  upcoming: { label: 'Upcoming', icon: 'calendar-outline', color: colors.purple },
  in_progress: { label: 'Happening now', icon: 'play-circle-outline', color: colors.gold },
  completed: { label: 'Ended', icon: 'checkmark-done', color: colors.green },
};

// Session chats show which session they belong to (tap to open it); direct
// messages show the friend.
function ConversationSummary({ conversation, navigation }) {
  const { session } = conversation;
  if (!session) {
    const friend = conversation.participants?.find((participant) => participant.id !== CURRENT_USER_ID);
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft }}>
        <Avatar name={conversation.name} uri={friend?.profilePicture} color={colors.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: '900' }}>{conversation.name}</Text>
          <Text style={{ color: colors.muted, marginTop: 3 }}>Direct message</Text>
        </View>
      </Card>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
      <Card style={{ gap: 10, backgroundColor: colors.purpleSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SportIcon sport={session.sport} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900' }}>{sessionTitle(session)}</Text>
            <Text style={{ color: colors.muted, marginTop: 3 }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>{playersLabel(session)} • {skillLabel(session)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.purple} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <StatusBadge {...(statusBadges[session.status] || statusBadges.upcoming)} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function ChatDetailScreen({ route, navigation }) {
  const scrollRef = useRef(null);
  const conversationId = route.params?.conversationId;
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(() => {
    if (!conversationId) return undefined;
    let active = true;
    setLoading(true);
    Promise.all([
      graphql(GET_CONVERSATION, { conversationId }),
      graphql(GET_CONVERSATION_MESSAGES, { conversationId, limit: 50 })
    ])
      .then(([conversationData, messageData]) => {
        if (!active) return;
        setConversation({ ...conversationData.getConversation, messages: messageData.getConversationMessages.messages });
        return graphql(MARK_CONVERSATION_READ, { conversationId });
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [conversationId]);

  useFocusEffect(useCallback(() => loadMessages(), [loadMessages]));

  useFocusEffect(useCallback(() => {
    if (!conversationId) return undefined;
    const socketUrl = API_URL.replace(/\/graphql$/, '');
    const socket = io(socketUrl, { auth: { token: getAuthToken() }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('joinConversation', conversationId));
    socket.on('message', (message) => {
      if (message.conversationId !== conversationId) return;
      const mine = message.sender?.id === CURRENT_USER_ID;
      setConversation((current) => addMessage(current, conversationId, { ...message, mine }));
      if (!mine) graphql(MARK_CONVERSATION_READ, { conversationId }).catch(() => {});
    });
    return () => socket.disconnect();
  }, [conversationId]));

  const send = async () => {
    if (!draft.trim() || sending || !conversationId) return;
    setSending(true);
    setError('');
    try {
      const data = await graphql(SEND_MESSAGE, {
        conversationId,
        body: draft,
        clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setConversation((current) => addMessage(current, conversationId, data.sendMessage));
      setDraft('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={conversation?.session ? `${conversation.session.sport} chat` : (conversation?.name || 'Chat')}
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 18, paddingBottom: 130, gap: 12 }}
      >
        {loading ? <ActivityIndicator color={colors.purple} /> : null}
        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
        {conversation ? <ConversationSummary conversation={conversation} navigation={navigation} /> : null}

        {(conversation?.messages || []).map((message) => (
          <View
            key={message.id}
            style={{
              alignSelf: message.mine ? 'flex-end' : 'flex-start',
              maxWidth: '84%',
              backgroundColor: message.mine ? colors.purple : colors.card,
              borderWidth: message.mine ? 0 : 1,
              borderColor: colors.line,
              borderRadius: 18,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: message.mine ? colors.card : colors.purpleDark, fontWeight: '900', marginBottom: 4 }}>{message.mine ? 'You' : message.sender.name}</Text>
            <Text style={{ color: message.mine ? colors.card : colors.text, lineHeight: 20 }}>{message.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 28, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={conversation?.kind === 'direct' ? `Message ${conversation.name.split(' ')[0]}...` : 'Message the group...'}
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 18,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 13,
            color: colors.ink,
            backgroundColor: colors.card,
          }}
        />
        <TouchableOpacity disabled={sending} onPress={send} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={19} color={colors.card} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
