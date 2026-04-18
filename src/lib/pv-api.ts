import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Location } from './adapter-config';

/** Hourly data structure from Open-Meteo API */
export interface OpenMeteoHourlyData {
	/** Array of ISO timestamps for each hour */
	time: string[];
	/** Array of irradiance values in W/m² */
	global_tilted_irradiance: number[];
	/** Array of temperature values at 2m height in °C */
	temperature_2m: number[];
	/** Array of cloud cover percentage values */
	cloud_cover: number[];
	/** Array of wind speed values at 10m height in km/h */
	wind_speed_10m: number[];
	/** Array of sunshine duration values in minutes */
	sunshine_duration: number[];
}

/** Response structure from Open-Meteo API */
export interface OpenMeteoResponse {
	/** Latitude of location */
	latitude: number;
	/** Longitude of location */
	longitude: number;
	/** Timezone identifier */
	timezone: string;
	/** Hourly forecast data */
	hourly: OpenMeteoHourlyData;
}

/** API caller for Open-Meteo and Nominatim services */
export class ApiCaller {
	private axiosInstance: AxiosInstance;
	private log: ioBroker.Logger;

	/**
	 * Initialize the API caller with axios configuration
	 *
	 * @param adapter - Adapter instance providing logger access
	 */
	constructor(adapter: ioBroker.Adapter) {
		this.log = adapter.log;
		this.axiosInstance = axios.create({
			timeout: 15000,
		});
	}

	/**
	 * Fetch PV forecast data from Open-Meteo API
	 *
	 * @param location - Location configuration
	 * @param forecastDays_pv - Number of days to forecast
	 * @returns Promise with forecast data
	 */
	async fetchForecastData(location: Location, forecastDays_pv: number): Promise<OpenMeteoResponse> {
		const hourlyparam_keys = 'global_tilted_irradiance,cloud_cover,temperature_2m,wind_speed_10m,sunshine_duration';
		const minutlyparam_keys =
			'global_tilted_irradiance,cloud_cover,temperature_2m,wind_speed_10m,sunshine_duration';
		const url = `https://api.open-meteo.com/v1/forecast`;

		try {
			const response = await this.axiosInstance.get<OpenMeteoResponse>(url, {
				params: {
					latitude: location.pv_latitude,
					longitude: location.pv_longitude,
					tilt: location.tilt,
					azimuth: location.azimuth,
					hourly: hourlyparam_keys,
					timezone: location.pv_timezone || 'auto',
					forecast_days: forecastDays_pv,
					minutely_15: minutlyparam_keys,
				},
			});

			// --- DEBUG LOG ---
			const fullUrl = axios.getUri(response.config);
			this.log.debug(`[${location.name}] DEBUG: API URL: ${fullUrl}`);
			// -----------------

			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				this.log.error(`Error retrieving PV data: ${error.config?.url}`);
				throw new Error(`PV API request failed: ${error.message}`);
			}
			throw error;
		}
	}
}
