import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import { weatherTranslations } from './lib/words';

class OpenMeteoWeather extends utils.Adapter {
    private updateInterval: ioBroker.Interval | undefined = undefined;
    private systemLang: string = 'de';
    private systemTimeZone: string = 'Europe/Berlin';

    constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'open-meteo-weather' });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        try {
            // Auslesen der ioBroker Systemeinstellungen
            const sysConfig = await this.getForeignObjectAsync('system.config');
            if (sysConfig && sysConfig.common) {
                this.systemLang = sysConfig.common.language || 'de';
                this.systemTimeZone = (sysConfig.common as any).timezone || 'Europe/Berlin';
            }
        } catch (e) {
            this.log.error('Konnte Systemeinstellungen nicht laden, nutze Defaults.');
            this.systemLang = 'de';
            this.systemTimeZone = 'Europe/Berlin';
        }

        this.log.info(`Adapter gestartet. Sprache: ${this.systemLang}, Zeitzone: ${this.systemTimeZone}`);
        
        // Erster Datenabruf beim Start
        await this.updateData();

        // Intervall für regelmäßige Updates
        const intervalMs = (this.config.interval || 15) * 60000;
        this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
    }

    private async updateData(): Promise<void> {
        try {
            const lat = this.config.latitude;
            const lon = this.config.longitude;

            if (!lat || !lon) {
                this.log.warn('Koordinaten fehlen in der Konfiguration! Abruf abgebrochen.');
                return;
            }

            // Zeitzone für die URL sicher kodieren
            const tz = encodeURIComponent(this.systemTimeZone);

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunshine_duration,sunset,uv_index_max,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean&timezone=${tz}&forecast_days=7`;
            const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&timezone=${tz}&forecast_days=7`;

            const resW = await axios.get(weatherUrl);
            const resA = await axios.get(airQualityUrl);

            if (resW.data) await this.processWeatherData(resW.data);
            if (resA.data) await this.processAirQualityData(resA.data);
            
            this.log.debug('Wetterdaten erfolgreich aktualisiert.');
        } catch (error: any) {
            this.log.error('Fehler beim Abruf der Wetterdaten: ' + error.message);
        }
    }

    private async processWeatherData(data: any): Promise<void> {
        const t = weatherTranslations[this.systemLang] || weatherTranslations['de'];

        if (data.current) {
            const isDay = data.current.is_day;
            const temp = data.current.temperature_2m;
            const hum = data.current.relative_humidity_2m;

            for (const key in data.current) {
                const val = data.current[key];
                await this.extendOrCreateState(`weather.current.${key}`, val);
                
                if (key === 'weather_code') {
                    await this.createCustomState('weather.current.weather_text', t.codes[val] || '?', 'string', 'text', '');
                    const iconSuffix = isDay === 1 ? '' : 'n';
                    await this.createCustomState('weather.current.icon_url', `/adapter/${this.name}/icons/${val}${iconSuffix}.png`, 'string', 'url', '');
                }
                if (key === 'wind_direction_10m') {
                    const text = t.dirs[Math.round(val / 45) % 8];
                    await this.createCustomState('weather.current.wind_direction_text', text, 'string', 'text', '');
                }
            }

            // Taupunkt-Berechnung (Magnus-Formel)
            if (temp !== undefined && hum !== undefined) {
                const a = 17.625;
                const b = 243.04;
                const alpha = Math.log(hum / 100) + (a * temp) / (b + temp);
                const dewPoint = (b * alpha) / (a - alpha);
                await this.createCustomState('weather.current.dew_point_2m', Math.round(dewPoint * 100) / 100, 'number', 'value.temperature', '°C');
            }
        }

        if (data.daily && data.daily.time) {
            for (let i = 0; i < data.daily.time.length; i++) {
                const dayPath = `weather.forecast.day${i}`;
                for (const key in data.daily) {
                    let val = data.daily[key][i];

                    if (val !== undefined && val !== null) {
                        if (key === 'sunshine_duration') val = Math.round((val / 3600) * 100) / 100;
                        if (key === 'sunrise' || key === 'sunset') val = val.split('T')[1]?.substring(0, 5) || val;

                        await this.extendOrCreateState(`${dayPath}.${key}`, val);

                        if (key === 'weather_code') {
                            await this.createCustomState(`${dayPath}.weather_text`, t.codes[val] || '?', 'string', 'text', '');
                            await this.createCustomState(`${dayPath}.icon_url`, `/adapter/${this.name}/icons/${val}.png`, 'string', 'url', '');
                        }
                        if (key === 'wind_direction_10m_dominant') {
                            const text = t.dirs[Math.round(val / 45) % 8];
                            await this.createCustomState(`${dayPath}.wind_direction_text`, text, 'string', 'text', '');
                        }
                    }
                }
            }
        }
    }

    private async processAirQualityData(data: any): Promise<void> {
        if (data.current) {
            const t = weatherTranslations[this.systemLang] || weatherTranslations['de'];
            for (const key in data.current) {
                const val = data.current[key];
                await this.extendOrCreateState(`air.current.${key}`, val);
                
                if (key.includes('_pollen')) {
                    let level = "none";
                    let thresholds = [1, 10, 50];
                    if (key.includes("birch")) thresholds = [10, 100, 500];
                    if (val >= thresholds[2]) level = "high";
                    else if (val >= thresholds[1]) level = "moderate";
                    else if (val >= thresholds[0]) level = "low";
                    
                    await this.createCustomState(`air.current.${key}_text`, t.pollen[level], 'string', 'text', '');
                }
            }
        }
    }

    private async createCustomState(id: string, val: any, type: any, role: string, unit: string): Promise<void> {
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: id.split('.').pop() || id, type: type, role: role, read: true, write: false, unit: unit },
            native: {},
        });
        await this.setStateAsync(id, val, true);
    }

    private async extendOrCreateState(id: string, val: any): Promise<void> {
        const unitMap: Record<string, string> = { 
            'temperature': '°C', 'humidity': '%', 'precipitation': 'mm', 'rain_sum': 'mm',
            'snowfall_sum': 'cm', 'wind_gusts': 'km/h', 'wind_speed': 'km/h', 
            'pm10': 'µg/m³', 'pm2_5': 'µg/m³', 'pollen': 'grains/m³', 'uv_index': 'UV',
            'sunshine_duration': 'h', 'cloud_cover': '%', 'dew_point': '°C', 'wind_direction': '°'
        };
        let unit = '';
        for (const k in unitMap) { if (id.includes(k)) { unit = unitMap[k]; break; } }

        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: id.split('.').pop() || id, type: typeof val as any, role: 'value', read: true, write: false, unit: unit },
            native: {},
        });
        await this.setStateAsync(id, val, true);
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