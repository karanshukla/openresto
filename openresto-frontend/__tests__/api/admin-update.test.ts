import { adminUpdateBookingFull, AdminUpdateBookingRequest } from '../../api/admin';

// Mock fetch for testing
global.fetch = jest.fn();

describe('adminUpdateBookingFull', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockBooking = {
    id: 123,
    restaurantId: 1,
    restaurantName: 'Test Restaurant',
    sectionId: 1,
    sectionName: 'Main',
    tableId: 1,
    tableName: 'Table 1',
    date: '2026-03-29T19:00:00Z',
    customerEmail: 'guest@example.com',
    seats: 2,
  };

  it('should successfully update a booking with full details', async () => {
    // Arrange
    const updateReq: AdminUpdateBookingRequest = {
      restaurantId: 2,
      sectionId: 3,
      tableId: 4,
      date: '2026-03-30T20:00:00Z',
      seats: 4,
      customerEmail: 'updated@example.com',
      specialRequests: 'Window seat please',
    };
    
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ ...mockBooking, ...updateReq }),
    });

    // Act
    const result = await adminUpdateBookingFull(123, updateReq);

    // Assert
    expect(fetch).toHaveBeenCalledWith('/api/admin/bookings/123', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateReq),
    });
    expect(result?.restaurantId).toBe(2);
    expect(result?.sectionId).toBe(3);
    expect(result?.tableId).toBe(4);
    expect(result?.seats).toBe(4);
    expect(result?.customerEmail).toBe('updated@example.com');
  });

  it('should throw error when update fails', async () => {
    // Arrange
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Table already booked' }),
    });

    const updateReq: AdminUpdateBookingRequest = { tableId: 99 };

    // Act & Assert
    await expect(adminUpdateBookingFull(123, updateReq)).rejects.toThrow('Table already booked');
  });

  it('should handle network errors during update', async () => {
    // Arrange
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    // Act & Assert
    await expect(adminUpdateBookingFull(123, {})).rejects.toThrow('Network failure');
  });
});
