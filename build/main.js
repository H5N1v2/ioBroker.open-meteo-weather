"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("@iobroker/adapter-core"));
const axios_1 = __importDefault(require("axios"));
const words_1 = require("./lib/words");
class OpenMeteoWeather extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'open-meteo-weather' });
        this.updateInterval = undefined;
        this.systemLang = 'de';
        this.systemTimeZone = 'Europe/Berlin';
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    async onReady() {
        try {
            // Auslesen der ioBroker Systemeinstellungen
            const sysConfig = await this.getForeignObjectAsync('system.config');
            if (sysConfig && sysConfig.common) {
                this.systemLang = sysConfig.common.language || 'de';
                this.systemTimeZone = sysConfig.common.timezone || 'Europe/Berlin';
            }
        }
        catch (e) {
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
    async updateData() {
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
            const resW = await axios_1.default.get(weatherUrl);
            const resA = await axios_1.default.get(airQualityUrl);
            if (resW.data)
                await this.processWeatherData(resW.data);
            if (resA.data)
                await this.processAirQualityData(resA.data);
            this.log.debug('Wetterdaten erfolgreich aktualisiert.');
        }
        catch (error) {
            this.log.error('Fehler beim Abruf der Wetterdaten: ' + error.message);
        }
    }
    async processWeatherData(data) {
        const t = words_1.weatherTranslations[this.systemLang] || words_1.weatherTranslations['de'];
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
                        if (key === 'sunshine_duration')
                            val = Math.round((val / 3600) * 100) / 100;
                        if (key === 'sunrise' || key === 'sunset')
                            val = val.split('T')[1]?.substring(0, 5) || val;
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
    async processAirQualityData(data) {
        if (data.current) {
            const t = words_1.weatherTranslations[this.systemLang] || words_1.weatherTranslations['de'];
            for (const key in data.current) {
                const val = data.current[key];
                await this.extendOrCreateState(`air.current.${key}`, val);
                if (key.includes('_pollen')) {
                    let level = "none";
                    let thresholds = [1, 10, 50];
                    if (key.includes("birch"))
                        thresholds = [10, 100, 500];
                    if (val >= thresholds[2])
                        level = "high";
                    else if (val >= thresholds[1])
                        level = "moderate";
                    else if (val >= thresholds[0])
                        level = "low";
                    await this.createCustomState(`air.current.${key}_text`, t.pollen[level], 'string', 'text', '');
                }
            }
        }
    }
    async createCustomState(id, val, type, role, unit) {
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: id.split('.').pop() || id, type: type, role: role, read: true, write: false, unit: unit },
            native: {},
        });
        await this.setStateAsync(id, val, true);
    }
    async extendOrCreateState(id, val) {
        const unitMap = {
            'temperature': '°C', 'humidity': '%', 'precipitation': 'mm', 'rain_sum': 'mm',
            'snowfall_sum': 'cm', 'wind_gusts': 'km/h', 'wind_speed': 'km/h',
            'pm10': 'µg/m³', 'pm2_5': 'µg/m³', 'pollen': 'grains/m³', 'uv_index': 'UV',
            'sunshine_duration': 'h', 'cloud_cover': '%', 'dew_point': '°C', 'wind_direction': '°'
        };
        let unit = '';
        for (const k in unitMap) {
            if (id.includes(k)) {
                unit = unitMap[k];
                break;
            }
        }
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: id.split('.').pop() || id, type: typeof val, role: 'value', read: true, write: false, unit: unit },
            native: {},
        });
        await this.setStateAsync(id, val, true);
    }
    onUnload(callback) {
        if (this.updateInterval)
            this.clearInterval(this.updateInterval);
        callback();
    }
}
if (require.main !== module) {
    module.exports = (options) => new OpenMeteoWeather(options);
}
else {
    new OpenMeteoWeather();
}
