import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Card, IconButton, NotificationButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { graphql } from '../../api';
import { getAuthToken } from '../../authToken';
import { API_URL } from '../../config';
import { GET_CONVERSATION_MESSAGES, MARK_CONVERSATION_READ, SEND_MESSAGE } from '../../graphql/queries';
import { io } from 'socket.io-client';

export default function ChatDetailScreen({ route, navigation }) {
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
    graphql(GET_CONVERSATION_MESSAGES, { conversationId, limit: 50 })
      .then((data) => {
        if (!active) return;
        const messages = data.getConversationMessages.messages;
        setConversation((current) => ({ ...(current || { id: conversationId, name: 'Chat', messages: [] }), messages }));
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
      setConversation((current) => {
        const messages = current?.messages || [];
        if (messages.some((existing) => existing.id === message.id)) return current;
        return { ...(current || { id: conversationId, name: 'Chat' }), messages: [...messages, message] };
      });
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
      setConversation((current) => ({ ...current, messages: [...(current?.messages || []), data.sendMessage] }));
      setDraft('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title={conversation?.name || 'Chat'}
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 130, gap: 12 }}>
        {loading ? <ActivityIndicator color={colors.purple} /> : null}
        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft }}>
          <Avatar name={conversation?.name || 'Chat'} color={colors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900' }}>{conversation?.name || 'Conversation'}</Text>
            <Text style={{ color: colors.muted, marginTop: 3 }}>Session coordination and quick updates.</Text>
          </View>
          <Ionicons name="notifications-outline" size={22} color={colors.purple} />
        </Card>

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
          placeholder="Message the group..."
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
    </View>
  );
}
