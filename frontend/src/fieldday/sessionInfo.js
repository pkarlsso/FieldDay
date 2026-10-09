import { graphql } from '../api';

// Mirrors the backend: 1-3 is the host's required level for a session.
export const SKILL_LEVELS = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' },
];

export const CAPACITY_LIMITS = { min: 2, max: 50 };

// Mirrors the backend: sessions default to 2 hours and last at most 24.
export const DEFAULT_SESSION_LENGTH_MS = 2 * 60 * 60 * 1000;
export const MAX_SESSION_LENGTH_MS = 24 * 60 * 60 * 1000;

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
export function validateSessionForm({ sport, startsAt, endsAt, location, locationConfirmed, maxParticipants, skillLevel }) {
  const errors = {};
  if (!sport) errors.sport = 'Choose a sport.';
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) errors.startsAt = 'Choose a date and time.';
  else if (startsAt <= new Date()) errors.startsAt = 'Choose a date and time in the future.';
  else if (!(endsAt instanceof Date) || endsAt <= startsAt) errors.endsAt = 'Choose an end time after the start.';
  else if (endsAt - startsAt > MAX_SESSION_LENGTH_MS) errors.endsAt = 'Sessions can last at most 24 hours.';
  if (!location.trim()) errors.location = 'Enter where the session is.';
  else if (!locationConfirmed) errors.location = 'Pick a suggestion, tap Find address, or tap the map so players can find it.';
  if (!Number.isInteger(maxParticipants) || maxParticipants < CAPACITY_LIMITS.min || maxParticipants > CAPACITY_LIMITS.max) {
    errors.maxParticipants = `Choose ${CAPACITY_LIMITS.min} to ${CAPACITY_LIMITS.max} players.`;
  }
  if (!SKILL_LEVELS.some((level) => level.value === skillLevel)) errors.skillLevel = 'Choose a skill level.';
  return errors;
}

const SESSION_FIELDS = `
  id sport startsAt endsAt location skillLevel skillRange maxParticipants status createdAt completedAt
  noShowDeadline
  host { id name }
  participants { id name profilePicture }
  attendance { user { id } status noShowReports }
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

// Groups the signed-in user's sessions for Home and My Sessions. The server
// already moves sessions to `completed` once their end time passes.
export function groupMySessions(mySessions, now = new Date()) {
  const { hosted = [], joined = [], completed = [] } = mySessions || {};
  const started = (session) => new Date(session.startsAt) <= now;
  const byStart = (a, b) => new Date(a.startsAt) - new Date(b.startsAt);
  return {
    upcoming: [...hosted, ...joined].filter((session) => !started(session)).sort(byStart),
    hostedUpcoming: hosted.filter((session) => !started(session)),
    joinedUpcoming: joined.filter((session) => !started(session)),
    happeningNow: [...hosted, ...joined].filter(started).sort(byStart),
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
