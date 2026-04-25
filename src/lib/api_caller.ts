// api_caller.ts
import type { AxiosError } from 'axios';
import axios from 'axios';

/**
 * Builds a descriptive error message from an Axios error, including the
 * Open-Meteo `reason` field when present in the response body.
 *
 * @param error - A confirmed Axios error
 * @param context - Short label used as prefix in the message (e.g. "Weather")
 * @returns A human-readable error message string
 */
function buildAxiosErrorMessage(error: AxiosError, context: string): string {
	const reason: string | undefined = (error.response?.data as { reason?: string } | undefined)?.reason;
	const reasonSuffix = reason ? ` – API reason: "${reason}"` : '';

	if (error.response) {
		const status = error.response.status;
		if (status === 429) {
			return `[${context}] Rate limit exceeded (429). Please increase the polling interval in the instance settings.${reasonSuffix}`;
		}
		if (status === 400) {
			return `[${context}] Invalid parameters (400 Bad Request). Please check coordinates and settings.${reasonSuffix}`;
		}
		if (status >= 500) {
			return `[${context}] Open-Meteo server error (${status}). The service may be temporarily unavailable.${reasonSuffix}`;
		}
		return `[${context}] HTTP ${status} error: ${error.message}${reasonSuffix}`;
	}

	if (error.request) {
		if (error.code === 'ECONNABORTED') {
			return `[${context}] Request timed out. The server did not respond in time.`;
		}
		return `[${context}] No response received from server. Check network connectivity or DNS.`;
	}

	return `[${context}] Failed to build API request: ${error.message}`;
}

/**
 * Handles an API error for a given context. Logs with the supplied log
 * function and optionally re-throws.
 *
 * @param error - The caught error (unknown)
 * @param context - Label used in log messages (e.g. "Weather")
 * @param log - Log function to call with the message (e.g. `logger.error`)
 * @param shouldThrow - Whether to re-throw after logging
 */
function handleApiError(
	error: unknown,
	context: string,
	log: ((msg: string) => void) | undefined,
	shouldThrow: boolean,
): void {
	let message: string;

	if (axios.isAxiosError(error)) {
		message = buildAxiosErrorMessage(error, context);
	} else if (error instanceof Error) {
		message = `[${context}] Unexpected error: ${error.message}`;
	} else {
		message = `[${context}] Unknown error occurred.`;
	}

	if (log) {
		log(message);
	}

	if (shouldThrow) {
		throw new Error(message);
	}
}
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
	/** Ob Luftqualtität Tage abgerufen werden sollen */
	airQualityForecastDays: number;
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
		const totalHours = config.forecastHours;
		fHoursParam = `&forecast_hours=${totalHours}`;
		fHoursParam_keys = `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,et0_fao_evapotranspiration,rain,weather_code,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,soil_temperature_0cm,uv_index,sunshine_duration,is_day,snowfall,snow_depth,freezing_level_height,snowfall_height`;
	}
	const currentparam_keys =
		'temperature_2m,relative_humidity_2m,pressure_msl,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day';

	const dailyparam_keys =
		'relative_humidity_2m_mean,weather_code,temperature_2m_max,temperature_2m_min,pressure_msl_mean,sunrise,sunshine_duration,sunset,uv_index_max,precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,et0_fao_evapotranspiration_sum,cloud_cover_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean';

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
	} catch (error: unknown) {
		handleApiError(error, 'Weather', logger?.error.bind(logger), true);
	}

	const pollenparam_keys =
		'pm10,pm2_5,nitrogen_dioxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen,carbon_monoxide,dust,olive_pollen,ozone';
	const pollenparam_keys_hourly = `&hourly=${pollenparam_keys}`;
	if (config.airQualityEnabled) {
		const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${config.latitude}&longitude=${config.longitude}&current=european_aqi,${pollenparam_keys}${pollenparam_keys_hourly}&timezone=${tz}&forecast_days=${config.forecastDays > 7 ? 7 : config.forecastDays}`;

		if (logger) {
			logger.debug(`Open-Meteo Air Quality URL: ${airUrl}`);
		}

		try {
			const resA = await axios.get(airUrl, axiosConfig);

			if (logger) {
				logger.debug(`Open-Meteo Air Quality Response Status: ${resA.status}`);
			}

			results.air = resA.data;
		} catch (error: unknown) {
			handleApiError(error, 'Air Quality', logger?.warn.bind(logger), false);
		}
	}

	return results;
}
