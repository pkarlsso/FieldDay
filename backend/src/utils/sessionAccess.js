// Who may see and join a session.
//
//   PUBLIC       everyone, including people who are not signed in.
//   FRIENDS      the host's friends.
//   INVITE_ONLY  people the host invited.
//
// The host and anyone already in the session can always see it. Access is
// worked out from the current data on every request, never stored:
//   - Becoming friends with the host gives access to their FRIENDS sessions
//     straight away; no longer being friends takes it away.
//   - Being invited gives access straight away; removing the invite takes it
//     away.
//   - Losing access never removes someone who already joined. They keep their
//     spot and can still see and leave the session.
// Friendships are always stored on both users, so the viewer's own friends
// list says whether they are friends with the host.

const VISIBILITIES = ['PUBLIC', 'FRIENDS', 'INVITE_ONLY'];

function idOf(value) {
  return String(value?._id ?? value);
}

function includesId(list, id) {
  return (list || []).some((entry) => idOf(entry) === String(id));
}

function visibilityOf(session) {
  return session.visibility || 'PUBLIC';
}

function canViewSession(session, user) {
  const visibility = visibilityOf(session);
  if (visibility === 'PUBLIC') return true;
  if (!user) return false;
  if (idOf(session.host) === String(user._id) || includesId(session.participants, user._id)) return true;
  if (visibility === 'FRIENDS') return includesId(user.friends, session.host);
  return includesId(session.invitees, user._id);
}

// The same rule as canViewSession, as a MongoDB filter.
function visibleSessionsFilter(user) {
  // `null` also matches sessions stored before visibility existed.
  const clauses = [{ visibility: { $in: ['PUBLIC', null] } }];
  if (user) {
    clauses.push(
      { host: user._id },
      { participants: user._id },
      { visibility: 'FRIENDS', host: { $in: user.friends || [] } },
      { visibility: 'INVITE_ONLY', invitees: user._id }
    );
  }
  return { $or: clauses };
}

export { VISIBILITIES, canViewSession, visibleSessionsFilter, visibilityOf };
