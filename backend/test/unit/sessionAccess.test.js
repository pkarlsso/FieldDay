// Unit tests for who may see a session (issue #217).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { canViewSession, visibilityOf, visibleSessionsFilter } from '../../src/utils/sessionAccess.js';

const id = () => new mongoose.Types.ObjectId();
const host = { _id: id(), friends: [] };
const friend = { _id: id(), friends: [host._id] };
const stranger = { _id: id(), friends: [] };
const invitee = { _id: id(), friends: [] };
const player = { _id: id(), friends: [] };

function session(visibility, fields = {}) {
  return { host: host._id, participants: [player._id], invitees: [invitee._id], visibility, ...fields };
}

describe('visibilityOf', () => {
  it('treats sessions stored before visibility existed as public', () => {
    assert.equal(visibilityOf({}), 'PUBLIC');
    assert.equal(visibilityOf({ visibility: null }), 'PUBLIC');
    assert.equal(visibilityOf({ visibility: 'FRIENDS' }), 'FRIENDS');
  });
});

describe('canViewSession', () => {
  it('shows public sessions to everyone, signed in or not', () => {
    for (const user of [null, stranger, friend, host]) assert.equal(canViewSession(session('PUBLIC'), user), true);
  });

  it('shows friends-only sessions to the host’s friends but not strangers', () => {
    assert.equal(canViewSession(session('FRIENDS'), friend), true);
    assert.equal(canViewSession(session('FRIENDS'), stranger), false);
    assert.equal(canViewSession(session('FRIENDS'), null), false);
  });

  it('shows invite-only sessions to invitees but not the host’s other friends', () => {
    assert.equal(canViewSession(session('INVITE_ONLY'), invitee), true);
    assert.equal(canViewSession(session('INVITE_ONLY'), friend), false);
    assert.equal(canViewSession(session('INVITE_ONLY'), stranger), false);
  });

  it('always shows a session to its host and the people already in it', () => {
    for (const visibility of ['FRIENDS', 'INVITE_ONLY']) {
      assert.equal(canViewSession(session(visibility), host), true, `host, ${visibility}`);
      assert.equal(canViewSession(session(visibility), player), true, `player, ${visibility}`);
    }
  });

  it('matches people whether lists hold ObjectIds, strings or populated users', () => {
    const populated = session('FRIENDS', { participants: [{ _id: player._id, name: 'Player' }] });
    assert.equal(canViewSession(populated, player), true);
    assert.equal(canViewSession(populated, stranger), false);

    const asStrings = session('INVITE_ONLY', { host: String(host._id), invitees: [String(invitee._id)] });
    assert.equal(canViewSession(asStrings, invitee), true);
    assert.equal(canViewSession(asStrings, host), true);
    assert.equal(canViewSession(asStrings, stranger), false);
  });

  it('gives and takes away access as friendships change', () => {
    const exFriend = { _id: friend._id, friends: [] };
    assert.equal(canViewSession(session('FRIENDS'), friend), true);
    assert.equal(canViewSession(session('FRIENDS'), exFriend), false);
  });
});

describe('visibleSessionsFilter', () => {
  it('only matches public sessions for someone not signed in', () => {
    assert.deepEqual(visibleSessionsFilter(null), { $or: [{ visibility: { $in: ['PUBLIC', null] } }] });
  });

  it('adds the same rules canViewSession uses for a signed-in user', () => {
    assert.deepEqual(visibleSessionsFilter(friend), {
      $or: [
        { visibility: { $in: ['PUBLIC', null] } },
        { host: friend._id },
        { participants: friend._id },
        { visibility: 'FRIENDS', host: { $in: friend.friends } },
        { visibility: 'INVITE_ONLY', invitees: friend._id }
      ]
    });
  });

  it('copes with a user who has no friends list', () => {
    const { $or } = visibleSessionsFilter({ _id: stranger._id });
    assert.deepEqual($or[3], { visibility: 'FRIENDS', host: { $in: [] } });
  });
});
