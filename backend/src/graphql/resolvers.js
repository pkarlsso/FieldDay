const User = require('../models/User');
const Session = require('../models/Session');

function formatSessionInput(input) {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error('startsAt must be a valid ISO date');
  const { longitude, latitude } = input.locationPoint;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('locationPoint coordinates are out of range');
  }
  return {
    ...input,
    date: startsAt.toISOString().slice(0, 10),
    time: startsAt.toISOString().slice(11, 16),
    startsAt,
    locationPoint: { type: 'Point', coordinates: [longitude, latitude] }
  };
}

function populatedSessionQuery(id) {
  return Session.findById(id).populate('participants').populate('host');
}

const resolvers = {
  Query: {
    getSession: async (_, { id }) => populatedSessionQuery(id),
    getUser: async (_, { id }) => {
      return User.findById(id).populate('friends');
    },

    getSessions: async (_, { status }) => {
      const filter = status ? { status } : {};
      return Session.find(filter)
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
    },

    getCompletedSessions: async (_, { userId }) => {
      return Session.find({
        status: 'completed',
        participants: userId,
        rated: false
      })
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
    },

    getFriends: async (_, { userId }) => {
      const user = await User.findById(userId).populate('friends');
      return user ? user.friends : [];
    }
  },

  Mutation: {
    createSession: async (_, { hostId, input }) => {
      const host = await User.findById(hostId);
      if (!host) throw new Error('Host not found');
      const session = await Session.create({
        ...formatSessionInput(input),
        host: hostId,
        participants: [hostId],
        status: 'upcoming'
      });
      return populatedSessionQuery(session._id);
    },

    joinSession: async (_, { sessionId, userId }) => {
      const [session, user] = await Promise.all([Session.findById(sessionId), User.findById(userId)]);
      if (!session || !user) throw new Error('Session or user not found');
      if (session.status !== 'upcoming') throw new Error('Only upcoming sessions can be joined');
      if (session.participants.some((id) => id.equals(userId))) return populatedSessionQuery(sessionId);
      if (session.participants.length >= session.maxParticipants) throw new Error('Session is full');
      session.participants.push(userId);
      await session.save();
      return populatedSessionQuery(sessionId);
    },

    leaveSession: async (_, { sessionId, userId }) => {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');
      if (session.host && session.host.equals(userId)) throw new Error('The host cannot leave their session');
      session.participants = session.participants.filter((id) => !id.equals(userId));
      await session.save();
      return populatedSessionQuery(sessionId);
    },

    submitRatings: async (_, { sessionId, raterId, ratings }) => {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');

      let totalGiven = 0;
      let friendsSent = 0;
      const updatedUsers = [];

      for (const { userId, rating, addFriend } of ratings) {
        const user = await User.findById(userId);
        if (!user) continue;

        user.addRating(rating);
        await user.save();
        totalGiven += rating;
        updatedUsers.push(user);

        if (addFriend) {
          const rater = await User.findById(raterId);
          if (rater && !rater.friends.includes(userId)) {
            rater.friends.push(userId);
            await rater.save();
            if (!user.friends.includes(raterId)) {
              user.friends.push(raterId);
              await user.save();
            }
            friendsSent++;
          }
        }
      }

      session.rated = true;
      await session.save();

      const avgRatingGiven = ratings.length > 0
        ? Math.round((totalGiven / ratings.length) * 10) / 10
        : 0;

      return {
        success: true,
        message: 'Ratings submitted successfully!',
        avgRatingGiven,
        friendRequestsSent: friendsSent,
        updatedUsers
      };
    },

    addFriend: async (_, { userId, friendId }) => {
      const user = await User.findById(userId);
      const friend = await User.findById(friendId);
      if (!user || !friend) throw new Error('User not found');

      if (!user.friends.includes(friendId)) {
        user.friends.push(friendId);
        await user.save();
      }
      if (!friend.friends.includes(userId)) {
        friend.friends.push(userId);
        await friend.save();
      }

      return User.findById(userId).populate('friends');
    }
  }
};

module.exports = resolvers;
