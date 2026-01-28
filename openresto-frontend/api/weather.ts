const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface WeatherForecast {
    date: string;
    temperatureC: number;
    summary: string;
    temperatureF: number;
}

export const getWeatherForecast = async (): Promise<WeatherForecast[]> => {
    try {
        const response = await fetch(`${API_URL}/weatherforecast`);
        if (!response.ok) {
            throw new Error('Failed to fetch weather forecast');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return [];
    }
};
