// api_caller.ts
import axios from 'axios';

/**
 * Konfiguration für den Wetter-API-Abruf
 */
export interface WeatherConfig {
	/** Breitengrad */
	latitude: number;
	/** Längengrad */
	longitude: number;
	/** Anzahl der Vorhersagetage */
	forecastDays: number;
	/** Anzahl der Vorhersagestunden */
	forecastHours: number;
	/** Ob stündliche Vorhersage aktiviert ist */
	forecastHoursEnabled: boolean;
	/** Ob Luftqualitätsdaten abgerufen werden sollen */
	airQualityEnabled: boolean;
	/** Die Zeitzone (z.B. Europe/Berlin) */
	timezone: string;
	/** Ob imperiale Einheiten genutzt werden sollen */
	isImperial: boolean;
}

/**
 * Holt alle Wetter- und Luftqualitätsdaten von der Open-Meteo API
 *
 * @param config Die Konfiguration für den Abruf
 * @param logger Optionaler ioBroker Logger für Debug-Ausgaben
 * @returns Die abgerufenen Wetterdaten als Objekt
 */
export async function fetchAllWeatherData(config: WeatherConfig, logger?: ioBroker.Logger): Promise<any> {
	const tz = encodeURIComponent(config.timezone);
	const results: any = {};

	// Axios-Konfiguration für Performance und Stabilität
	const axiosConfig = {
		timeout: 15000,
		headers: {
			Connection: 'close',
		},
	};

	// Imperiale Parameter vorbereiten
	const unitParams = config.isImperial
		? '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch'
		: '';

	let fHoursParam = '';
	let fHoursParam_keys = '';

	if (config.forecastHoursEnabled) {
		const totalHours = config.forecastDays * 24;
		fHoursParam = `&forecast_hours=${totalHours}`;
		fHoursParam_keys = `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,weather_code,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,soil_temperature_0cm,uv_index,sunshine_duration,is_day,snowfall,snow_depth`;
	}
	const currentparam_keys =
		'temperature_2m,relative_humidity_2m,pressure_msl,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day';

	const dailyparam_keys =
		'relative_humidity_2m_mean,weather_code,temperature_2m_max,temperature_2m_min,pressure_msl_mean,sunrise,sunshine_duration,sunset,uv_index_max,precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean';

	// URL mit unitParams erweitern
	const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current=${currentparam_keys}&daily=${dailyparam_keys}${fHoursParam_keys}&timezone=${tz}&forecast_days=${config.forecastDays}${fHoursParam}${unitParams}`;

	if (logger) {
		logger.debug(`Open-Meteo Weather URL: ${weatherUrl}`);
	}

	try {
		const resW = await axios.get(weatherUrl, axiosConfig);

		if (logger) {
			logger.debug(`Open-Meteo Weather Response Status: ${resW.status}`);
		}

		results.weather = resW.data;

		if (resW.data.hourly) {
			results.hourly = resW.data;
		}
	} catch (error: any) {
		if (logger) {
			logger.error(`Fehler beim Abrufen der Wetterdaten: ${error.message}`);
		}
		throw new Error(`Weather API request failed: ${error.message}`);
	}

	const pollenparam_keys =
		'pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen,carbon_monoxide,dust,olive_pollen,ozone';
	if (config.airQualityEnabled) {
		const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${config.latitude}&longitude=${config.longitude}&current=european_aqi,${pollenparam_keys}&timezone=${tz}&forecast_days=${config.forecastDays > 7 ? 7 : config.forecastDays}`;

		if (logger) {
			logger.debug(`Open-Meteo Air Quality URL: ${airUrl}`);
		}

		try {
			const resA = await axios.get(airUrl, axiosConfig);

			if (logger) {
				logger.debug(`Open-Meteo Air Quality Response Status: ${resA.status}`);
			}

			results.air = resA.data;
		} catch (error: any) {
			if (logger) {
				logger.warn(`Fehler beim Abrufen der Luftqualitätsdaten: ${error.message}`);
			}
			// Luftqualität ist optional, daher kein throw
		}
	}

	return results;
}
