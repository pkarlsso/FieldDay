import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { graphql } from '../api';
import logger from '../logger';

const QUERY = `
  query CurrentUser {
    me {
      id name bio hometown profilePicture socialRating totalRatings cooldownUntil
      profileComplete profileSetupMissing
      sportSkills { sport skillLevel }
      availability { day periods }
      friends { id name profilePicture socialRating sports }
    }
  }
`;

// The signed-in user's profile, refetched whenever the screen regains focus so
// edits made on Edit Profile show up right away. null until the first load.
// Also returns `reload`, to refetch without leaving the screen.
export function useCurrentUserWithReload() {
  const [user, setUser] = useState(null);

  const load = useCallback(() => {
    let active = true;
    graphql(QUERY)
      .then((data) => { if (active) setUser(data.me); })
      .catch((err) => logger.error('Current user fetch error:', err));
    return () => { active = false; };
  }, []);

  useFocusEffect(load);

  return [user, load];
}

export function useCurrentUser() {
  return useCurrentUserWithReload()[0];
}

export function firstName(user) {
  return user?.name?.split(' ')[0] || '';
}
