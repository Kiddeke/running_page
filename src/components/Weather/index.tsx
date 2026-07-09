import { useEffect, useState } from 'react';

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear', emoji: '☀️' },
  1: { label: 'Mostly Clear', emoji: '🌤️' },
  2: { label: 'Partly Cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Foggy', emoji: '🌫️' },
  48: { label: 'Foggy', emoji: '🌫️' },
  51: { label: 'Light Drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Heavy Drizzle', emoji: '🌧️' },
  61: { label: 'Light Rain', emoji: '🌧️' },
  63: { label: 'Rain', emoji: '🌧️' },
  65: { label: 'Heavy Rain', emoji: '🌧️' },
  71: { label: 'Light Snow', emoji: '🌨️' },
  73: { label: 'Snow', emoji: '❄️' },
  75: { label: 'Heavy Snow', emoji: '❄️' },
  80: { label: 'Rain Showers', emoji: '🌦️' },
  81: { label: 'Rain Showers', emoji: '🌦️' },
  82: { label: 'Heavy Showers', emoji: '⛈️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  99: { label: 'Thunderstorm', emoji: '⛈️' },
};

interface WeatherData {
  tempF: number;
  condition: string;
  emoji: string;
  windMph: number;
}

const Weather = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.3464&longitude=-94.8730&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FChicago'
    )
      .then((r) => r.json())
      .then((d) => {
        const code = d.current.weathercode as number;
        const info = WMO_CODES[code] ?? { label: 'Unknown', emoji: '🌡️' };
        setWeather({
          tempF: Math.round(d.current.temperature_2m),
          condition: info.label,
          emoji: info.emoji,
          windMph: Math.round(d.current.windspeed_10m),
        });
      })
      .catch(() => null);
  }, []);

  if (!weather) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm opacity-70">
      <span>{weather.emoji}</span>
      <span>{weather.tempF}°F</span>
      <span className="opacity-50">·</span>
      <span>{weather.condition}</span>
      <span className="opacity-50">·</span>
      <span>{weather.windMph} mph</span>
    </div>
  );
};

export default Weather;
