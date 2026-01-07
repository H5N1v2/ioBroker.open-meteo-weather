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
const i18n_1 = require("./i18n");
class OpenMeteoWeather extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'open-meteo-weather' });
        this.updateInterval = undefined;
        this.systemLang = 'de';
        this.systemTimeZone = 'Europe/Berlin';
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    // Lädt Übersetzungen für State-Namen aus der i18n
    getTranslation(key) {
        if (!i18n_1.translations)
            return key;
        return i18n_1.translations[this.systemLang]?.[key] || i18n_1.translations['en']?.[key] || key;
    }
    // Wandelt Grad-Zahlen in Windrichtung (N, NO, etc.) um
    getWindDirection(deg) {
        const t = words_1.weatherTranslations[this.systemLang] || words_1.weatherTranslations['de'];
        const directions = t.dirs || ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
        const index = Math.round(deg / 45) % 8;
        return directions[index];
    }
    // Initialisierung: Lädt Systemeinstellungen, startet Cleanup und Interval
    async onReady() {
        try {
            const sysConfig = await this.getForeignObjectAsync('system.config');
            if (sysConfig && sysConfig.common) {
                this.systemLang = sysConfig.common.language || 'de';
                this.systemTimeZone = sysConfig.common.timezone || 'Europe/Berlin';
            }
            await this.cleanupObjects();
        }
        catch (e) {
            this.log.error('Initialisierung fehlgeschlagen.');
        }
        await this.updateData();
        const config = this.config;
        const intervalMs = (parseInt(config.interval) || 30) * 60000;
        this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
    }
    // Löscht deaktivierte AirQuality-Daten und überzählige Forecast-Tage
    async cleanupObjects() {
        const config = this.config;
        const maxDays = parseInt(config.forecastDays);
        // Air Quality Cleanup
        if (config.airQualityEnabled === false) {
            await this.delObjectAsync('air', { recursive: true });
        }
        // Forecast Days Cleanup
        try {
            const allObjects = await this.getAdapterObjectsAsync();
            const allIds = Object.keys(allObjects);
            for (const id of allIds) {
                const match = id.match(/day(\d+)/);
                if (match) {
                    const dayNumber = parseInt(match[1]);
                    if (dayNumber >= maxDays) {
                        const relativeId = id.replace(`${this.namespace}.`, '');
                        const pathParts = relativeId.split('.');
                        const dayPartIndex = pathParts.findIndex(p => p.startsWith('day'));
                        if (dayPartIndex !== -1) {
                            const folderToDelete = pathParts.slice(0, dayPartIndex + 1).join('.');
                            try {
                                await this.delObjectAsync(folderToDelete, { recursive: true });
                            }
                            catch (e) { }
                        }
                    }
                }
            }
        }
        catch (err) {
            this.log.error(`Cleanup Fehler: ${err.message}`);
        }
    }
    // Hauptfunktion zum Abrufen der Wetter- und Luftqualitätsdaten
    async updateData() {
        try {
            const config = this.config;
            const lat = config.latitude;
            const lon = config.longitude;
            const fDays = config.forecastDays || 7;
            const airQualityEnabled = config.airQualityEnabled || false;
            if (!lat || !lon)
                return;
            const tz = encodeURIComponent(this.systemTimeZone);
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunshine_duration,sunset,uv_index_max,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean&timezone=${tz}&forecast_days=${fDays}`;
            const resW = await axios_1.default.get(weatherUrl);
            if (resW.data)
                await this.processWeatherData(resW.data);
            if (airQualityEnabled) {
                const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&timezone=${tz}&forecast_days=${fDays > 7 ? 7 : fDays}`;
                const resA = await axios_1.default.get(airQualityUrl);
                if (resA.data)
                    await this.processAirQualityData(resA.data);
            }
        }
        catch (error) {
            this.log.error(`Abruf fehlgeschlagen: ${error.message}`);
        }
    }
    // Verarbeitet Wetterdaten und erstellt die entsprechenden States
    async processWeatherData(data) {
        const t = words_1.weatherTranslations[this.systemLang] || words_1.weatherTranslations['de'];
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
    // Verarbeitet Luftqualitätsdaten und Pollenwerte
    async processAirQualityData(data) {
        const t = words_1.weatherTranslations[this.systemLang] || words_1.weatherTranslations['de'];
        if (data.current) {
            for (const key in data.current) {
                await this.extendOrCreateState(`air.current.${key}`, data.current[key], key);
                if (key.includes('pollen')) {
                    const val = data.current[key];
                    let pollenText = t.pollen.none;
                    if (val > 0 && val <= 1)
                        pollenText = t.pollen.low;
                    else if (val > 1 && val <= 2)
                        pollenText = t.pollen.moderate;
                    else if (val > 2)
                        pollenText = t.pollen.high;
                    await this.createCustomState(`air.current.${key}_text`, pollenText, 'string', 'text', '');
                }
            }
        }
    }
    // Erstellt manuelle States (z.B. Texte oder Icons)
    async createCustomState(id, val, type, role, unit) {
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: this.getTranslation(id.split('.').pop() || id), type, role, read: true, write: false, unit },
            native: {},
        });
        await this.setStateAsync(id, { val, ack: true });
    }
    // Erstellt oder aktualisiert automatische States inkl. Einheiten-Mapping
    async extendOrCreateState(id, val, translationKey) {
        const unitMap = { 'temperature': '°C', 'humidity': '%', 'precipitation': 'mm', 'wind': 'km/h', 'pm': 'µg/m³', 'cloud': '%', 'wind_direction': '°', 'dew_point': '°C', 'apparent': '°C' };
        let unit = '';
        for (const k in unitMap) {
            if (id.includes(k))
                unit = unitMap[k];
        }
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: this.getTranslation(translationKey || id.split('.').pop() || id), type: typeof val, role: 'value', read: true, write: false, unit },
            native: {},
        });
        await this.setStateAsync(id, { val, ack: true });
    }
    // Stoppt das Interval beim Beenden des Adapters
    onUnload(callback) {
        if (this.updateInterval)
            this.clearInterval(this.updateInterval);
        callback();
    }
}
// Start der Instanz
if (require.main !== module) {
    module.exports = (options) => new OpenMeteoWeather(options);
}
else {
    new OpenMeteoWeather();
}
