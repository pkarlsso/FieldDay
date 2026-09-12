import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Avatar, Card, IconButton, NotificationButton, PrimaryButton, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { sessions } from '../data/mockData';

const reportReasons = ['No-show', 'Unsafe play', 'Harassment', 'Wrong skill level'];

export default function RateSessionScreen({ route, navigation }) {
  const session = sessions.find((item) => item.id === route.params?.sessionId) || sessions[0];
  const [ratings, setRatings] = useState(
    session.players.reduce((acc, player) => ({ ...acc, [player.id]: player.present ? 4 : 2 }), {})
  );
  const [friends, setFriends] = useState(
    session.players.reduce((acc, player, index) => ({ ...acc, [player.id]: index < 2 }), {})
  );
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportNotes, setReportNotes] = useState('');
  const [submittedReports, setSubmittedReports] = useState({});

  const submit = () => {
    const avgRatingGiven = Math.round(
      (Object.values(ratings).reduce((sum, value) => sum + value, 0) / Object.values(ratings).length) * 10
    ) / 10;
    const friendRequestsSent = Object.values(friends).filter(Boolean).length;
    navigation.navigate('SessionComplete', {
      sessionId: session.id,
      avgRatingGiven,
      friendRequestsSent,
      playersRated: session.players.length,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Rate Session"
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 14 }}>
        <Card style={{ backgroundColor: colors.purpleSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SportIcon sport={session.sport} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>{session.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{session.date} • {session.time}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 20 }}>{session.joined}/{session.maxParticipants}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>joined</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 20 }}>1</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>absent</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 20 }}>2</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>friend adds</Text>
            </View>
          </View>
        </Card>

        <Card style={{ padding: 14, backgroundColor: colors.card }}>
          <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16, marginBottom: 8 }}>How ratings work</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['1 Beginner', '3 Solid', '5 Excellent'].map((label) => (
              <View key={label} style={{ backgroundColor: colors.purpleSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: colors.purpleDark, fontWeight: '800', fontSize: 12 }}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {session.players.map((player) => (
          <Card key={player.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={player.name} color={player.present ? colors.purple : colors.coral} size={50} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>{player.name}</Text>
                <Text style={{ color: player.present ? colors.green : colors.coral, marginTop: 3, fontWeight: '800' }}>
                  {player.present ? 'Present' : 'Marked absent'}
                </Text>
              </View>
              <StatusBadge
                label={friends[player.id] ? 'Friend' : 'Add'}
                icon={friends[player.id] ? 'person-add' : 'person-add-outline'}
                color={friends[player.id] ? colors.green : colors.muted}
              />
              <TouchableOpacity
                onPress={() => setFriends((value) => ({ ...value, [player.id]: !value[player.id] }))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: friends[player.id] ? colors.green : colors.line,
                  backgroundColor: friends[player.id] ? colors.green : colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={18} color={friends[player.id] ? colors.card : colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>1</Text>
                <Text style={{ color: colors.purple, fontSize: 20, fontWeight: '900' }}>{ratings[player.id]}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>5</Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={ratings[player.id]}
                minimumTrackTintColor={colors.purple}
                maximumTrackTintColor={colors.line}
                thumbTintColor={colors.purple}
                onValueChange={(value) => setRatings((current) => ({ ...current, [player.id]: value }))}
              />
            </View>
            <TextInput
              placeholder="Add optional comment..."
              placeholderTextColor={colors.muted}
              style={{ marginTop: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  setReportTarget(player);
                  setReportReason(reportReasons[0]);
                  setReportNotes('');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: submittedReports[player.id] ? colors.coralSoft : colors.card,
                  borderWidth: 1,
                  borderColor: colors.coral,
                  borderRadius: 999,
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                }}
              >
                <Ionicons name={submittedReports[player.id] ? 'flag' : 'flag-outline'} size={14} color={colors.coral} />
                <Text style={{ color: colors.coral, fontWeight: '900', fontSize: 12 }}>
                  {submittedReports[player.id] ? 'Report Filed' : 'Report User'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        <PrimaryButton label="Submit Ratings" icon="checkmark-circle-outline" onPress={submit} />
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(reportTarget)}
        onRequestClose={() => setReportTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(22,23,29,0.42)', justifyContent: 'center', padding: 22 }}>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flag-outline" size={23} color={colors.coral} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Report {reportTarget?.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>This demo logs a safety/reporting action.</Text>
              </View>
              <IconButton icon="close" onPress={() => setReportTarget(null)} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  activeOpacity={0.84}
                  onPress={() => setReportReason(reason)}
                  style={{
                    backgroundColor: reportReason === reason ? colors.coral : colors.coralSoft,
                    borderRadius: 999,
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: reportReason === reason ? colors.card : colors.coral, fontSize: 12, fontWeight: '900' }}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              multiline
              value={reportNotes}
              onChangeText={setReportNotes}
              placeholder="Add optional details..."
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 88,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 12,
                color: colors.ink,
                textAlignVertical: 'top',
                backgroundColor: colors.page,
              }}
            />

            <PrimaryButton
              label="Submit Report"
              icon="flag-outline"
              variant="destructive"
              onPress={() => {
                if (reportTarget) {
                  setSubmittedReports((current) => ({ ...current, [reportTarget.id]: reportReason }));
                }
                setReportTarget(null);
              }}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setReportTarget(null)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
