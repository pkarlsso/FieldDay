import { graphql } from '../api';

// Mirrors the backend: 1-3 is the host's required level for a session.
export const SKILL_LEVELS = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' },
];

export const CAPACITY_LIMITS = { min: 2, max: 50 };

// Mirrors the backend's SessionVisibility.
export const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Anyone', detail: 'Anyone can find this session on Explore and the map.' },
  { value: 'FRIENDS', label: 'Friends', detail: 'Only your friends can find and join this session.' },
  { value: 'INVITE_ONLY', label: 'Invite only', detail: 'Only the friends you pick below can find and join this session.' },
];

// Mirrors the backend: sessions default to 2 hours and last at most 24.
export const DEFAULT_SESSION_LENGTH_MS = 2 * 60 * 60 * 1000;
export const MAX_SESSION_LENGTH_MS = 24 * 60 * 60 * 1000;
// Mirrors the backend: sessions freeze (no edits, cancels or leaving) 5
// minutes before they start, and the roster check happens then too: full-only
// sessions stop taking players, and solo sessions are called off.
export const CHANGE_FREEZE_MS = 5 * 60 * 1000;
export const JOIN_CUTOFF_MS = 5 * 60 * 1000;

// True once the 5-minute freeze before the start has begun.
export function changesFrozen(session, now = new Date()) {
  const freezeAt = session.changesFreezeAt
    ? new Date(session.changesFreezeAt)
    : new Date(new Date(session.startsAt).getTime() - CHANGE_FREEZE_MS);
  return freezeAt <= now;
}

// What a player signs up for by joining or hosting (#377): a normal session
// expects them unless they leave before the freeze; a full-only one expects
// them only if it fills. `startsAt` is a Date or ISO string.
export function commitmentWarning({ startsAt, fullOnly, maxParticipants, hosting = false }) {
  const start = new Date(startsAt).getTime();
  const freezeAt = formatSessionTime(new Date(start - CHANGE_FREEZE_MS));
  const noShow = 'Players who don\'t come can be reported as no-shows, which gives them a rating of 1.';
  const exit = hosting
    ? `You can edit or cancel it until ${freezeAt}, 5 minutes before it starts.`
    : `You can leave until ${freezeAt}, 5 minutes before it starts.`;
  if (fullOnly) {
    const closesAt = formatSessionTime(new Date(start - JOIN_CUTOFF_MS));
    return {
      title: hosting ? 'Only if full' : 'You\'re expected if it fills up',
      message: `This session only happens if all ${maxParticipants} spots are taken by ${closesAt}, when joining closes. `
        + 'If it doesn\'t fill, it\'s called off and nobody needs to go. '
        + `If it does fill, ${hosting ? 'everyone, including you, is' : 'you\'re'} expected to show up. ${noShow} ${exit}`,
    };
  }
  // A session with only the host doesn't go ahead (#360), so the host is only
  // on the hook once someone else joins.
  if (hosting) {
    return {
      title: 'You\'re expected if someone joins',
      message: 'As the host, you only need to show up if at least one other player joins. '
        + 'If nobody has joined by 5 minutes before it starts, the session is called off and nobody is marked as a no-show. '
        + `Once someone joins, you're expected to be there unless you cancel in time. ${exit} After that it's locked. ${noShow}`,
    };
  }
  return {
    title: 'You\'re expected to show up',
    message: `Once you join, you're expected to show up unless you leave in time. ${exit} After that it's locked. ${noShow}`,
  };
}

// True when the host still has nobody else in an upcoming session, so they
// aren't expected to go yet.
export function hostIsAlone(session) {
  return session.status === 'upcoming' && (session.participants?.length ?? 0) < 2;
}

// True once the session no longer takes new players.
export function joinClosed(session, now = new Date()) {
  return Boolean(session.joinClosesAt) && new Date(session.joinClosesAt) <= now;
}

export function skillLabel(session) {
  const level = SKILL_LEVELS.find((item) => item.value === session?.skillLevel);
  if (level) return level.label;
  // Sessions created before skill levels only have a free-form range.
  return session?.skillRange ? `Skill ${session.skillRange}` : 'Any skill';
}

export function playersLabel(session) {
  return `${session.participants?.length ?? 0}/${session.maxParticipants} players`;
}

export function sessionTitle(session) {
  return `${session.sport} at ${session.location}`;
}

export function formatSessionTime(startsAt) {
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// "Sat, Oct 4, 6:00 PM – 8:00 PM", or both full dates if it crosses midnight.
export function formatSessionRange(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return formatSessionTime(startsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endText = sameDay
    ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : formatSessionTime(endsAt);
  return `${formatSessionTime(startsAt)} – ${endText}`;
}

// Client-side copy of the createSession rules, so the form can point at the
// exact field to fix before anything is sent.
// When editing, `joinedCount` is how many players have already joined, since
// capacity can't drop below that.
// `editing` adds the edit-only rule that a moved session must still start at
// least 5 minutes from now.
export function validateSessionForm({ sport, startsAt, endsAt, location, locationConfirmed, maxParticipants, skillLevel, joinedCount = 0, visibility = 'PUBLIC', inviteeIds = [], editing = false }) {
  const errors = {};
  if (!sport) errors.sport = 'Choose a sport.';
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) errors.startsAt = 'Choose a date and time.';
  else if (startsAt <= new Date()) errors.startsAt = 'Choose a date and time in the future.';
  else if (editing && startsAt.getTime() - Date.now() <= CHANGE_FREEZE_MS) errors.startsAt = 'Choose a start at least 5 minutes from now.';
  else if (!(endsAt instanceof Date) || endsAt <= startsAt) errors.endsAt = 'Choose an end time after the start.';
  else if (endsAt - startsAt > MAX_SESSION_LENGTH_MS) errors.endsAt = 'Sessions can last at most 24 hours.';
  if (!location.trim()) errors.location = 'Enter where the session is.';
  else if (!locationConfirmed) errors.location = 'Pick a suggestion, tap Find address, or tap the map so players can find it.';
  if (!Number.isInteger(maxParticipants) || maxParticipants < CAPACITY_LIMITS.min || maxParticipants > CAPACITY_LIMITS.max) {
    errors.maxParticipants = `Choose ${CAPACITY_LIMITS.min} to ${CAPACITY_LIMITS.max} players.`;
  } else if (maxParticipants < joinedCount) {
    errors.maxParticipants = `${joinedCount} players have already joined, so choose at least ${joinedCount}.`;
  }
  if (!SKILL_LEVELS.some((level) => level.value === skillLevel)) errors.skillLevel = 'Choose a skill level.';
  if (visibility === 'INVITE_ONLY' && inviteeIds.length === 0) errors.visibility = 'Pick at least one friend to invite.';
  return errors;
}

const SESSION_FIELDS = `
  id sport startsAt endsAt location skillLevel skillRange maxParticipants status createdAt completedAt
  noShowDeadline cancelledAt fullOnly joinClosesAt changesFreezeAt invalidReason
  host { id name }
  participants { id name profilePicture }
  attendance { user { id } status noShowReports checkedInAt }
  myNoShowReport { noShows reportedAt }
  ratingEligibility { eligible reason }
`;

const MY_SESSIONS_QUERY = `
  query MySessions {
    getMySessions {
      hosted { ${SESSION_FIELDS} }
      joined { ${SESSION_FIELDS} }
      completed { ${SESSION_FIELDS} }
    }
  }
`;

export async function loadMySessions() {
  const data = await graphql(MY_SESSIONS_QUERY);
  return data.getMySessions;
}

export function attendanceFor(session, userId) {
  return session.attendance?.find((entry) => entry.user.id === userId);
}

// True when the signed-in user still owes the "who didn't show up?" answer.
export function needsNoShowCheck(session, now = new Date()) {
  return session.status === 'completed'
    && Boolean(session.noShowDeadline)
    && !session.myNoShowReport
    && new Date(session.noShowDeadline) > now;
}

export function isCancelled(session) {
  return session.status === 'cancelled';
}

// Not going ahead (too few players, or a full-only session that didn't fill)
// and not yet past its planned end. Afterwards the server reports it as
// cancelled.
export function isNotHappening(session) {
  return session.status === 'invalid';
}

// Groups the signed-in user's sessions for Home and My Sessions. The server
// already moves sessions to `completed` once their end time passes. Cancelled
// sessions stay in the Hosting/Joined lists (marked) until they would have
// started; sessions that aren't happening stay there (marked) until their
// planned end. Neither counts as upcoming or happening now.
export function groupMySessions(mySessions, now = new Date()) {
  const { hosted = [], joined = [], completed = [] } = mySessions || {};
  const started = (session) => new Date(session.startsAt) <= now;
  const byStart = (a, b) => new Date(a.startsAt) - new Date(b.startsAt);
  const listed = (session) => !started(session) || isNotHappening(session);
  const active = [...hosted, ...joined].filter((session) => !isCancelled(session) && !isNotHappening(session));
  return {
    upcoming: active.filter((session) => !started(session)).sort(byStart),
    hostedUpcoming: hosted.filter(listed),
    joinedUpcoming: joined.filter(listed),
    happeningNow: active.filter(started).sort(byStart),
    completed,
    needsNoShowCheck: completed.filter((session) => needsNoShowCheck(session, now)),
    needsRating: completed.filter((session) => session.ratingEligibility.eligible),
  };
}

// A short, newest-first feed built from the timestamps sessions already carry.
export function buildActivity(mySessions, userId, limit = 5) {
  const { hosted = [], joined = [], completed = [] } = mySessions || {};
  const items = [];
  for (const session of [...hosted, ...joined, ...completed]) {
    const title = sessionTitle(session);
    if (session.host?.id === userId && session.createdAt) {
      items.push({ id: `${session.id}-created`, at: session.createdAt, icon: 'add-circle-outline', label: 'You created a session', detail: title });
    }
    if (session.completedAt) {
      items.push({ id: `${session.id}-completed`, at: session.completedAt, icon: 'checkmark-done-outline', label: 'Session ended', detail: title });
    }
    if (session.myNoShowReport) {
      const count = session.myNoShowReport.noShows.length;
      items.push({
        id: `${session.id}-no-shows`,
        at: session.myNoShowReport.reportedAt,
        icon: count ? 'person-remove-outline' : 'people-outline',
        label: count ? `You reported ${count} no-show${count === 1 ? '' : 's'}` : 'You said everyone showed up',
        detail: title,
      });
    }
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}
