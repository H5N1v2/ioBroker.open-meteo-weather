import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import { weatherTranslations } from './lib/words';
import { translations } from './i18n';

class OpenMeteoWeather extends utils.Adapter {
    private updateInterval: ioBroker.Interval | undefined = undefined;
    private systemLang: string = 'de';
    private systemTimeZone: string = 'Europe/Berlin';

    constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'open-meteo-weather' });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private getTranslation(key: string): string {
        if (!translations) return key;
        return translations[this.systemLang]?.[key] || translations['en']?.[key] || key;
    }

private getWindDirection(deg: number): string {
        const t = weatherTranslations[this.systemLang] || weatherTranslations['de'];
        const directions = t.dirs || ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
        const index = Math.round(deg / 45) % 8;
        return directions[index];
    }

    private async onReady(): Promise<void> {
        try {
            const sysConfig = await this.getForeignObjectAsync('system.config');
            if (sysConfig && sysConfig.common) {
                this.systemLang = sysConfig.common.language || 'de';
                this.systemTimeZone = (sysConfig.common as any).timezone || 'Europe/Berlin';
            }
        } catch (e) {
            this.log.error('Systemeinstellungen konnten nicht geladen werden.');
        }
        await this.updateData();
        const config = this.config as any;
        const intervalMs = (parseInt(config.interval) || 30) * 60000;
        this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
    }

    private async updateData(): Promise<void> {
        try {
            const config = this.config as any;
            const lat = config.latitude;
            const lon = config.longitude;
            const fDays = config.forecastDays || 7;
            const airQualityEnabled = config.airQualityEnabled || false; // Hier wird der Wert aus der Konfiguration abgerufen
            if (!lat || !lon) return;

            const tz = encodeURIComponent(this.systemTimeZone);
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunshine_duration,sunset,uv_index_max,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean&timezone=${tz}&forecast_days=${fDays}`;
            if (airQualityEnabled) {
            const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&timezone=${tz}&forecast_days=${fDays > 7 ? 7 : fDays}`;
            const resA = await axios.get(airQualityUrl);
            if (resA.data) await this.processAirQualityData(resA.data);
            }
            const resW = await axios.get(weatherUrl);
            if (resW.data) await this.processWeatherData(resW.data);

        } catch (error: any) {
            this.log.error(`Abruf fehlgeschlagen: ${error.message}`);
        }
    }

    private async processWeatherData(data: any): Promise<void> {
        const t = weatherTranslations[this.systemLang] || weatherTranslations['de'];

        if (data.current) {
            const isDay = data.current.is_day;
            for (const key in data.current) {
                await this.extendOrCreateState(`weather.current.${key}`, data.current[key], key);
                if (key === 'weather_code') {
                    const code = data.current[key];
                    await this.createCustomState('weather.current.weather_text', t.codes[code] || '?', 'string', 'text', '');
                    await this.createCustomState('weather.current.icon_url', `/adapter/${this.name}/icons/${code}${isDay === 1 ? '' : 'n'}.png`, 'string', 'url', '');
                }
                if (key === 'wind_direction_10m') {
                    await this.createCustomState('weather.current.wind_direction_text', this.getWindDirection(data.current[key]), 'string', 'text', '');
                }
            }
        }

        if (data.daily && data.daily.time) {
            for (let i = 0; i < data.daily.time.length; i++) {
                const dayPath = `weather.forecast.day${i}`;
                for (const key in data.daily) {
                    let val = data.daily[key][i];
                    await this.extendOrCreateState(`${dayPath}.${key}`, val, key);
                    
                    if (key === 'weather_code') {
                        await this.createCustomState(`${dayPath}.weather_text`, t.codes[val] || '?', 'string', 'text', '');
                        await this.createCustomState(`${dayPath}.icon_url`, `/adapter/${this.name}/icons/${val}.png`, 'string', 'url', '');
                    }
                    if (key === 'wind_direction_10m_dominant') {
                        await this.createCustomState(`${dayPath}.wind_direction_text`, this.getWindDirection(val), 'string', 'text', '');
                    }
                }
            }
        }
    }

private async processAirQualityData(data: any): Promise<void> {
        const t = weatherTranslations[this.systemLang] || weatherTranslations['de'];
        
        if (data.current) {
            for (const key in data.current) {
                await this.extendOrCreateState(`air.current.${key}`, data.current[key], key);
                
                // Wenn es ein Pollen-Wert ist, übersetze ihn in deinen Text
                if (key.includes('pollen')) {
                    const val = data.current[key];
                    let pollenText = t.pollen.none; // Standard: Keine

                    if (val > 0 && val <= 1) pollenText = t.pollen.low;
                    else if (val > 1 && val <= 2) pollenText = t.pollen.moderate;
                    else if (val > 2) pollenText = t.pollen.high;

                    await this.createCustomState(`air.current.${key}_text`, pollenText, 'string', 'text', '');
                }
            }
        }
    }

    private async createCustomState(id: string, val: any, type: ioBroker.CommonType, role: string, unit: string): Promise<void> {
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: this.getTranslation(id.split('.').pop() || id), type, role, read: true, write: false, unit },
            native: {},
        });
        await this.setStateAsync(id, { val, ack: true });
    }

    private async extendOrCreateState(id: string, val: any, translationKey?: string): Promise<void> {
        const unitMap: Record<string, string> = { 'temperature': '°C', 'humidity': '%', 'precipitation': 'mm', 'wind': 'km/h', 'pm': 'µg/m³', 'cloud': '%','wind_direction': '°', 'dew_point': '°C', 'apparent': '°C' };
        let unit = '';
        for (const k in unitMap) { if (id.includes(k)) unit = unitMap[k]; }
        
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: this.getTranslation(translationKey || id.split('.').pop() || id), type: typeof val as any, role: 'value', read: true, write: false, unit },
            native: {},
        });
        await this.setStateAsync(id, { val, ack: true });
    }

    private onUnload(callback: () => void): void {
        if (this.updateInterval) this.clearInterval(this.updateInterval);
        callback();
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new OpenMeteoWeather(options);
} else {
    new OpenMeteoWeather();
}