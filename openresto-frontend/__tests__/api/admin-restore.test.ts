import { adminRestoreBooking } from '../../api/admin';

// Mock fetch for testing
global.fetch = jest.fn();

describe('adminRestoreBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully restore a booking', async () => {
    // Arrange
    const mockResponse = { ok: true };
    (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    // Act
    const result = await adminRestoreBooking(123);

    // Assert
    expect(fetch).toHaveBeenCalledWith('/admin/bookings/123/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: undefined,
    });
    expect(result).toBe(true);
  });

  it('should throw error when response is not ok', async () => {
    // Arrange
    const mockResponse = { 
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Booking not found' })
    };
    (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    // Act & Assert
    await expect(adminRestoreBooking(123)).rejects.toThrow('Booking not found');
  });

  it('should throw generic error when response has no message', async () => {
    // Arrange
    const mockResponse = { 
      ok: false,
      json: jest.fn().mockRejectedValue(new Error('JSON parse error'))
    };
    (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    // Act & Assert
    await expect(adminRestoreBooking(123)).rejects.toThrow('Failed to restore booking');
  });

  it('should handle network errors', async () => {
    // Arrange
    const networkError = new Error('Network error');
    (fetch as jest.Mock).mockRejectedValueOnce(networkError);

    // Act & Assert
    await expect(adminRestoreBooking(123)).rejects.toThrow('Network error');
  });

  it('should call console.error on failure', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockResponse = { 
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Server error' })
    };
    (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    // Act
    try {
      await adminRestoreBooking(123);
    } catch {
      // Expected to throw
    }

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('adminRestoreBooking error:', expect.any(Error));
    
    // Cleanup
    consoleSpy.mockRestore();
  });
});
