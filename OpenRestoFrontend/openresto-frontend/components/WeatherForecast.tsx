import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getWeatherForecast, WeatherForecast } from '@/api/weather';
import { ThemedText } from './themed-text';

const WeatherForecastComponent: React.FC = () => {
    const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchForecasts = async () => {
            const data = await getWeatherForecast();
            setForecasts(data);
            setLoading(false);
        };

        fetchForecasts();
    }, []);

    if (loading) {
        return <ThemedText>Loading weather forecast...</ThemedText>;
    }

    return (
        <View style={styles.container}>
            <ThemedText type="subtitle">Weather Forecast</ThemedText>
            {forecasts.map((forecast, index) => (
                <View key={index} style={styles.forecastItem}>
                    <ThemedText>{new Date(forecast.date).toLocaleDateString()}: {forecast.summary} at {forecast.temperatureC}°C / {forecast.temperatureF}°F</ThemedText>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    forecastItem: {
        paddingVertical: 8,
    },
});

export default WeatherForecastComponent;
