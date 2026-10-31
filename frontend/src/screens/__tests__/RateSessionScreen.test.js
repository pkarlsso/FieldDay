/* global describe, expect, it, jest */
import { Alert, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import RateSessionScreen from '../RateSessionScreen';
import { graphql } from '../../api';

jest.mock('../../api', () => ({
  graphql: jest.fn(),
}));

jest.mock('../../config', () => ({
  CURRENT_USER_ID: 'current-user',
}));

const session = {
  id: 'session-123',
  sport: 'Pickleball',
  date: '2026-10-31',
  location: 'Hildegard Park',
  participants: [
    { id: 'current-user', name: 'Uma' },
    { id: 'player-one', name: 'Alex' },
    { id: 'player-two', name: 'Taylor' },
  ],
};

async function renderScreen() {
  const navigation = { navigate: jest.fn() };
  return {
    navigation,
    ...(await render(<RateSessionScreen route={{ params: { session } }} navigation={navigation} />)),
  };
}

describe('RateSessionScreen', () => {
  it('submits the changed rating and add-friend choice in the GraphQL payload', async () => {
    graphql.mockResolvedValue({
      submitRatings: { avgRatingGiven: 4, friendRequestsSent: 1 },
    });
    const view = await renderScreen();

    await fireEvent.press(view.getAllByText('5')[0]);
    await act(async () => {
      view.UNSAFE_getAllByType(TouchableOpacity)[0].props.onPress();
    });
    await act(async () => {
      const buttons = view.UNSAFE_getAllByType(TouchableOpacity);
      await buttons[buttons.length - 1].props.onPress();
    });

    await waitFor(() => {
      expect(graphql).toHaveBeenCalledWith(
        expect.stringContaining('mutation SubmitRatings'),
        {
          sessionId: 'session-123',
          raterId: 'current-user',
          ratings: [
            { userId: 'player-one', rating: 5, addFriend: true },
            { userId: 'player-two', rating: 3, addFriend: false },
          ],
        }
      );
    });
  });

  it('navigates to Session Complete with the returned submission statistics', async () => {
    graphql.mockResolvedValue({
      submitRatings: { avgRatingGiven: 4.5, friendRequestsSent: 1 },
    });
    const { navigation, UNSAFE_getAllByType } = await renderScreen();

    await act(async () => {
      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      await buttons[buttons.length - 1].props.onPress();
    });

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('SessionComplete', {
        avgRatingGiven: 4.5,
        friendRequestsSent: 1,
        playersRated: 2,
      });
    });
  });

  it('displays an error when the rating submission fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    graphql.mockRejectedValue(new Error('Unable to submit ratings'));
    const { UNSAFE_getAllByType } = await renderScreen();

    await act(async () => {
      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      await buttons[buttons.length - 1].props.onPress();
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Unable to submit ratings');
    });
  });
});
