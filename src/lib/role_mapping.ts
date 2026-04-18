// lib/role_mapping.ts

const baseRoles: Record<string, string> = {
	// Luftqualität & Pollenflug
	pm10: 'value',
	pm2_5: 'value',
	nitrogen_dioxide: 'value',
	alder_pollen: 'value',
	birch_pollen: 'value',
	grass_pollen: 'value',
	mugwort_pollen: 'value',
	ragweed_pollen: 'value',
	carbon_monoxide: 'value',
	dust: 'value',
	olive_pollen: 'value',
	ozone: 'value',
	european_aqi: 'value',

	// Temperaturen
	temperature_2m: 'value.temperature',
	temperature_2m_max: 'value.temperature.max',
	temperature_2m_min: 'value.temperature.min',
	apparent_temperature: 'value.temperature.feelslike',
	dew_point_2m: 'value.temperature.dewpoint',
	dew_point_2m_mean: 'value',
	soil_temperature_0cm: 'value',

	// Feuchtigkeit & Druck
	relative_humidity_2m: 'value.humidity',
	relative_humidity_2m_mean: 'value.humidity',
	pressure_msl: 'value.pressure',
	pressure_msl_mean: 'value.pressure',

	// Niederschlag
	precipitation: 'value.precipitation',
	precipitation_sum: 'value.precipitation.day',
	precipitation_probability: 'value.precipitation.chance',
	precipitation_probability_max: 'value.precipitation.chance',
	rain: 'value.rain',
	rain_sum: 'value.rain',
	snowfall: 'value.snow',
	snowfall_sum: 'value.snow',
	snowfall_height: 'value.snowline',
	et0_fao_evapotranspiration: 'value',

	// Wind
	wind_speed_10m: 'value.speed.wind',
	wind_speed_10m_max: 'value.speed.max.wind',
	wind_direction_10m: 'value.direction.wind',
	wind_direction_10m_dominant: 'value.direction.wind',
	wind_gusts_10m: 'value.speed.wind.gust',
	wind_gusts_10m_max: 'value.speed.wind.gust',

	// Sonne, Wolken & Wetter
	cloud_cover: 'value.clouds',
	cloud_cover_max: 'value.clouds',
	uv_index: 'value.uv',
	uv_index_max: 'value.uv',
	sunshine_duration: 'value.radiation',
	sunrise: 'date.sunrise',
	sunset: 'date.sunset',
	weather_code: 'weather.state',

	// Schnee/Frost
	snow_depth: 'value',
	freezing_level_height: 'value',
};

/**
 * Ermittelt die exakte ioBroker-Rolle basierend auf dem API-Key und dem Zeitkontext.
 *
 * @param context - Time context: 'current', 'daily', or 'hourly'.
 * @param key - The API key name (e.g., 'temperature_2m').
 * @param index - Optional index for daily forecasts (0=today, 1=tomorrow).
 * @returns The standardized ioBroker role string.
 */
export function getRole(context: 'current' | 'daily' | 'hourly', key: string, index?: number): string {
	const base = baseRoles[key] || 'value';

	// Spezielle Behandlung für dew_point_2m, rain, snowfall und precipitation_probability: Nur Stunde 0 bekommt die Rolle.
	if (key === 'dew_point_2m' || key === 'rain' || key === 'snowfall' || key === 'precipitation_probability') {
		if (context === 'hourly' && index !== undefined && index > 0) {
			return 'value';
		}
	}

	// Für Tagesvorhersagen: Hänge .forecast.X an
	// 1. Liste der Keys, die NIEMALS ein .forecast.X erhalten sollen
	const noForecastSuffix = [
		'cloud_cover_max',
		'uv_index_max',
		'precipitation_probability_max',
		'rain_sum',
		'relative_humidity_2m_mean',
		'snowfall_sum',
		'sunshine_duration',
	];

	const downgradeToValue = ['snowfall_sum', 'precipitation_probability_max', 'rain_sum'];

	// 2. Für Tagesvorhersagen: Hänge .forecast.X an
	if (context === 'daily' && index !== undefined) {
		// Auschlussliste ab day1
		if (index > 0 && downgradeToValue.includes(key)) {
			return 'value';
		}
		// Prüfe, ob der Key in der Ausschlussliste steht
		if (noForecastSuffix.includes(key)) {
			return base;
		}
		// Standard-Logik für alle anderen (Temperatur, Regen etc.)
		if (base.startsWith('value.') || base.startsWith('weather.')) {
			return `${base}.forecast.${index}`;
		}
	}

	if (key === 'sunrise' || key === 'sunset') {
		if (context === 'daily') {
			if (index === 0) {
				return `date.${key}`;
			}
			return 'value';
		}
	}

	// Für stündliche Vorhersagen: Spezifische .hour Anhänge (laut stateroles.md)
	if (context === 'hourly') {
		if (key === 'precipitation' || key === 'rain' || key === 'snowfall') {
			return `${base}.hour`;
		}
	}

	// Standardrückgabe für current und alle anderen
	return base;
}
