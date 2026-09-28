const logger = require('../utils/logger');

// Caching variables stored in the server's memory
let cachedWeatherData = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// Fetch weather data for the sidebar widget
exports.getWeather = async (req, res) => {
    try {
        const currentTime = Date.now();

        // 1. Check if we have cached data and if it's less than 15 minutes old
        if (cachedWeatherData && (currentTime - lastFetchTime < CACHE_DURATION_MS)) {
            return res.status(200).json({
                message: 'Weather data retrieved from cache',
                source: 'cache',
                data: cachedWeatherData
            });
        }

        // 2. If no cache or cache expired, fetch fresh data from the external API
        // Note: You need a free API key from OpenWeatherMap.
        const apiKey = '6f30c9b0f30195fbbee6cd2b4e2edcb9';
        const city = 'Tel Aviv';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

        // Using native Node.js fetch
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`External API responded with status: ${response.status}`);
        }

        const weatherData = await response.json();

        // 3. Update the cache with the new data and current timestamp
        cachedWeatherData = {
            temperature: weatherData.main.temp,
            description: weatherData.weather[0].description,
            icon: weatherData.weather[0].icon,
            city: weatherData.name
        };
        lastFetchTime = currentTime;

        // 4. Send the fresh data to the client
        res.status(200).json({
            message: 'Fresh weather data retrieved from API',
            source: 'api',
            data: cachedWeatherData
        });

    } catch (error) {
        logger.logError('Error fetching weather data', error);

        // If the external API fails, try to return old cached data if it exists (graceful degradation)
        if (cachedWeatherData) {
            return res.status(200).json({
                message: 'API failed, falling back to old cached data',
                source: 'stale_cache',
                data: cachedWeatherData
            });
        }

        res.status(500).json({ 
            message: 'Error fetching weather data', 
            error: error.message 
        });
    }
};