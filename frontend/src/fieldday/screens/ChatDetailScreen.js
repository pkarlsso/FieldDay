import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, IconButton, NotificationButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { conversations } from '../data/mockData';

export default function ChatDetailScreen({ route, navigation }) {
  const conversation = conversations.find((item) => item.id === route.params?.conversationId) || conversations[0];
  const [draft, setDraft] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title={conversation.name}
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 130, gap: 12 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft }}>
          <Avatar name={conversation.name} color={colors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900' }}>{conversation.meta}</Text>
            <Text style={{ color: colors.muted, marginTop: 3 }}>Session coordination and quick updates.</Text>
          </View>
          <Ionicons name="notifications-outline" size={22} color={colors.purple} />
        </Card>

        {conversation.messages.map((message) => (
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
            <Text style={{ color: message.mine ? colors.card : colors.purpleDark, fontWeight: '900', marginBottom: 4 }}>{message.author}</Text>
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
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={19} color={colors.card} />
        </View>
      </View>
    </View>
  );
}
