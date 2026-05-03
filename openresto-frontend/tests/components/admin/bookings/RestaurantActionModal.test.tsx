import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import RestaurantActionModal from '@/components/admin/bookings/RestaurantActionModal';
import * as adminApi from '@/api/admin';
import { useAppTheme } from '@/hooks/use-app-theme';

// Mock the API and theme hook
jest.mock('@/api/admin');
jest.mock('@/hooks/use-app-theme');

const mockRestaurants = [
  { id: 1, name: 'Test Restaurant 1', bookingsPausedUntil: null, activeBookingsCount: 5 },
  { id: 2, name: 'Test Restaurant 2', bookingsPausedUntil: new Date(Date.now() + 3600000).toISOString(), activeBookingsCount: 2 }
];

const mockTheme = {
  colors: {
    card: '#fff',
    border: '#eee',
    muted: '#888',
    success: '#16a34a'
  },
  primaryColor: '#007AFF'
};

describe('RestaurantActionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAppTheme as jest.Mock).mockReturnValue(mockTheme);
    (adminApi.adminGetRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
  });

  it('renders correctly when visible and type is pause', async () => {
    const { getByText, queryByTestId } = render(
      <RestaurantActionModal visible={true} actionType="pause" onClose={() => {}} />
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    expect(getByText('Pause Bookings')).toBeTruthy();
    expect(getByText('Select a restaurant to pause or resume its bookings.')).toBeTruthy();
    expect(getByText('Test Restaurant 1')).toBeTruthy();
    expect(getByText('Test Restaurant 2')).toBeTruthy();
  });

  it('renders correctly when type is extend', async () => {
    const { getByText, queryByTestId } = render(
      <RestaurantActionModal visible={true} actionType="extend" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    expect(getByText('Extend Bookings')).toBeTruthy();
    expect(getByText('Select a restaurant to extend all active bookings by 1 hour.')).toBeTruthy();
  });

  it('calls pauseRestaurantBookings when a restaurant is clicked and type is pause', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    (adminApi.pauseRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true });

    const { getByText, queryByTestId } = render(
      <RestaurantActionModal visible={true} actionType="pause" onClose={onClose} onSuccess={onSuccess} />
    );

    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    fireEvent.press(getByText('Test Restaurant 1'));

    await waitFor(() => {
      expect(adminApi.pauseRestaurantBookings).toHaveBeenCalledWith(1, 60);
      expect(onSuccess).toHaveBeenCalledWith('Bookings for Test Restaurant 1 have been paused for 1 hour.');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls unpauseRestaurantBookings when a paused restaurant is clicked and type is pause', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    (adminApi.unpauseRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true });

    const { getByText, queryByTestId } = render(
      <RestaurantActionModal visible={true} actionType="pause" onClose={onClose} onSuccess={onSuccess} />
    );

    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    fireEvent.press(getByText('Test Restaurant 2'));

    await waitFor(() => {
      expect(adminApi.unpauseRestaurantBookings).toHaveBeenCalledWith(2);
      expect(onSuccess).toHaveBeenCalledWith('Bookings for Test Restaurant 2 have been resumed.');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls extendRestaurantBookings and shows extended bookings list when type is extend', async () => {
    const extendedBookings = [
      { id: 101, customerEmail: 'test@example.com', date: new Date().toISOString(), seats: 2, endTime: new Date(Date.now() + 7200000).toISOString() }
    ];
    (adminApi.extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings });

    const { getByText, queryByTestId } = render(
      <RestaurantActionModal visible={true} actionType="extend" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    fireEvent.press(getByText('Test Restaurant 1'));

    await waitFor(() => {
      expect(adminApi.extendRestaurantBookings).toHaveBeenCalledWith(1, 60);
      expect(getByText('Bookings Extended')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <RestaurantActionModal visible={true} actionType="pause" onClose={onClose} />
    );

    fireEvent.press(getByTestId('close-modal-button'));
    expect(onClose).toHaveBeenCalled();
  });
});
