import { adminGetRestaurants, adminGetSections } from '../../api/admin';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Admin lookup APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adminGetRestaurants', () => {
    it('should return restaurants on success', async () => {
      const mockData = [{ id: 1, name: 'Resto A' }, { id: 2, name: 'Resto B' }];
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockData),
      });

      const result = await adminGetRestaurants();

      expect(fetch).toHaveBeenCalledWith('/api/admin/restaurants', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('should return empty array on failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
      const result = await adminGetRestaurants();
      expect(result).toEqual([]);
    });
  });

  describe('adminGetSections', () => {
    it('should return sections for a restaurant', async () => {
      const mockData = [{ id: 10, name: 'Main' }];
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockData),
      });

      const result = await adminGetSections(1);

      expect(fetch).toHaveBeenCalledWith('/api/admin/restaurants/1/sections', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('should return empty array on failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
      const result = await adminGetSections(1);
      expect(result).toEqual([]);
    });
  });
});
