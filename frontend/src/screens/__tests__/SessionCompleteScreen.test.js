/* global describe, expect, it, jest */
import { fireEvent, render } from '@testing-library/react-native';

import SessionCompleteScreen from '../SessionCompleteScreen';

async function renderScreen() {
  const navigation = { navigate: jest.fn() };
  return {
    navigation,
    ...(await render(
      <SessionCompleteScreen
        route={{
          params: {
            avgRatingGiven: 4.5,
            friendRequestsSent: 2,
            playersRated: 3,
          },
        }}
        navigation={navigation}
      />
    )),
  };
}

describe('SessionCompleteScreen', () => {
  it('displays the rating, friend-request, and player statistics from the route', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('3 players')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('returns to Home when Done is pressed', async () => {
    const { navigation, getByText } = await renderScreen();

    await fireEvent.press(getByText('Done'));

    expect(navigation.navigate).toHaveBeenCalledWith('Home');
  });
});
