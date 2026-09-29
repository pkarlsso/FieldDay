import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { graphql } from '../../api';
import { GET_CONVERSATIONS } from '../../graphql/queries';
import { Avatar, Card, NotificationButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';

export default function ChatScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConversations = useCallback(() => {
    let active = true;
    setLoading(true);
    graphql(GET_CONVERSATIONS)
      .then((data) => { if (active) setConversations(data.getConversations || []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => loadConversations(), [loadConversations]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Chat" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 12 }}>
        {loading ? <ActivityIndicator color={colors.purple} /> : null}
        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
        {!loading && !error && conversations.length === 0 ? (
          <Card><Text style={{ color: colors.muted }}>Your session and friend conversations will appear here.</Text></Card>
        ) : null}
        {conversations.map((conversation) => (
          <TouchableOpacity key={conversation.id} activeOpacity={0.88} onPress={() => navigation.navigate('ChatDetail', { conversationId: conversation.id })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={conversation.name} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{conversation.name}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>
                  {conversation.messages[0]?.body || 'No messages yet'}
                </Text>
              </View>
              {conversation.unreadCount > 0 ? (
                <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.card, fontWeight: '900' }}>{conversation.unreadCount}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}