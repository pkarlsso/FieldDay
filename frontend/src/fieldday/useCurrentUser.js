import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { graphql } from '../api';
import { CURRENT_USER_ID } from '../config';

const QUERY = `
  query CurrentUser($id: ID!) {
    getUser(id: $id) {
      id name bio hometown profilePicture socialRating totalRatings
      sportSkills { sport skillLevel }
      friends { id name profilePicture socialRating sports }
    }
  }
`;

// The signed-in user's profile, refetched whenever the screen regains focus so
// edits made on Edit Profile show up right away. null until the first load.
export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      graphql(QUERY, { id: CURRENT_USER_ID })
        .then((data) => { if (active) setUser(data.getUser); })
        .catch((err) => console.log('Current user fetch error:', err.message));
      return () => { active = false; };
    }, []),
  );

  return user;
}

export function firstName(user) {
  return user?.name?.split(' ')[0] || '';
}
