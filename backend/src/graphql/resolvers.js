const User = require('../models/User');
const Session = require('../models/Session');

const resolvers = {
  Query: {
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
