"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_words = require("./lib/words");
var import_i18n = require("./i18n");
var import_api_caller = require("./lib/api_caller");
var import_units = require("./lib/units");
class OpenMeteoWeather extends utils.Adapter {
  updateInterval = void 0;
  systemLang = "de";
  systemTimeZone = "Europe/Berlin";
  constructor(options = {}) {
    super({ ...options, name: "open-meteo-weather" });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  getTranslation(key) {
    var _a, _b;
    if (!import_i18n.translations) {
      return key;
    }
    return ((_a = import_i18n.translations[this.systemLang]) == null ? void 0 : _a[key]) || ((_b = import_i18n.translations.en) == null ? void 0 : _b[key]) || key;
  }
  getWindDirection(deg) {
    const t = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
    const directions = t.dirs || ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  }
  getWindDirectionIcon(deg) {
    const fileNames = ["n.png", "no.png", "o.png", "so.png", "s.png", "sw.png", "w.png", "nw.png"];
    const index = Math.round(deg / 45) % 8;
    return `/adapter/${this.name}/icons/wind_direction_icons/${fileNames[index]}`;
  }
  getWindGustIcon(gusts) {
    const config = this.config;
    const isImperial = config.isImperial || false;
    const factor = isImperial ? 1.60934 : 1;
    if (gusts < 39 / factor) {
      return "";
    }
    if (gusts < 50 / factor) {
      return `/adapter/${this.name}/icons/wind_icons/0.png`;
    }
    if (gusts < 62 / factor) {
      return `/adapter/${this.name}/icons/wind_icons/1.png`;
    }
    if (gusts < 75 / factor) {
      return `/adapter/${this.name}/icons/wind_icons/2.png`;
    }
    if (gusts < 89 / factor) {
      return `/adapter/${this.name}/icons/wind_icons/3.png`;
    }
    return `/adapter/${this.name}/icons/wind_icons/4.png`;
  }
  calculateDewPoint(temp, humidity) {
    const config = this.config;
    const isImperial = config.isImperial || false;
    const t = isImperial ? (temp - 32) * 5 / 9 : temp;
    const rh = humidity / 100;
    const a = 17.625;
    const b = 243.04;
    const alpha = Math.log(rh) + a * t / (b + t);
    let dewPoint = b * alpha / (a - alpha);
    if (isImperial) {
      dewPoint = dewPoint * 9 / 5 + 32;
    }
    return parseFloat(dewPoint.toFixed(1));
  }
  async onReady() {
    try {
      const sysConfig = await this.getForeignObjectAsync("system.config");
      if (sysConfig && sysConfig.common) {
        this.systemLang = sysConfig.common.language || "de";
        this.systemTimeZone = sysConfig.common.timezone || "Europe/Berlin";
      }
      await this.cleanupDeletedLocations();
    } catch {
      this.log.error("Initialisierung fehlgeschlagen.");
    }
    await this.updateData();
    const config = this.config;
    const intervalMs = (parseInt(config.updateInterval) || 30) * 6e4;
    this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
  }
  async cleanupDeletedLocations() {
    const config = this.config;
    const locations = config.locations || [];
    const validFolders = locations.map((loc) => loc.name.replace(/[^a-zA-Z0-9]/g, "_"));
    const forecastDays = parseInt(config.forecastDays) || 1;
    const forecastHoursEnabled = config.forecastHoursEnabled || false;
    const airQualityEnabled = config.airQualityEnabled || false;
    const hoursLimit = parseInt(config.forecastHours) || 24;
    const allObjects = await this.getAdapterObjectsAsync();
    for (const objId in allObjects) {
      const parts = objId.split(".");
      if (parts.length > 2) {
        const folderName = parts[2];
        if (!validFolders.includes(folderName)) {
          this.log.info(`L\xF6sche veralteten Standort: ${folderName}`);
          await this.delObjectAsync(objId, { recursive: true });
          continue;
        }
        if (!airQualityEnabled && objId.includes(`${folderName}.air`)) {
          await this.delObjectAsync(objId, { recursive: true });
          continue;
        }
        if (!forecastHoursEnabled && objId.includes(`${folderName}.weather.forecast.hourly`)) {
          await this.delObjectAsync(objId, { recursive: true });
          continue;
        }
        if (forecastHoursEnabled && objId.includes(".hourly.day")) {
          const hourlyDayMatch = objId.match(/\.hourly\.day(\d+)/);
          if (hourlyDayMatch) {
            const hDayNum = parseInt(hourlyDayMatch[1]);
            if (hDayNum >= forecastDays) {
              this.log.debug(`Cleanup st\xFCndlich: L\xF6sche Tag ${hDayNum} f\xFCr ${folderName}`);
              await this.delObjectAsync(objId, { recursive: true });
              continue;
            }
          }
        }
        if (objId.includes(`${folderName}.weather.forecast.day`) && !objId.includes(".hourly.")) {
          const dayMatch = objId.match(/\.day(\d+)/);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1]);
            if (dayNum >= forecastDays) {
              await this.delObjectAsync(objId, { recursive: true });
              continue;
            }
          }
        }
        if (forecastHoursEnabled && objId.includes(".hourly.day")) {
          const hourMatch = objId.match(/\.hour(\d+)/);
          if (hourMatch) {
            const hourNum = parseInt(hourMatch[1]);
            if (hourNum >= hoursLimit) {
              await this.delObjectAsync(objId, { recursive: true });
              continue;
            }
          }
        }
      }
    }
  }
  async updateData() {
    try {
      const config = this.config;
      const locations = config.locations;
      if (!locations || !Array.isArray(locations) || locations.length === 0) {
        this.log.warn("Keine Standorte konfiguriert.");
        return;
      }
      for (const loc of locations) {
        const folderName = loc.name.replace(/[^a-zA-Z0-9]/g, "_");
        const data = await (0, import_api_caller.fetchAllWeatherData)({
          latitude: loc.latitude,
          longitude: loc.longitude,
          forecastDays: config.forecastDays || 7,
          forecastHours: config.forecastHours || 1,
          forecastHoursEnabled: config.forecastHoursEnabled || false,
          airQualityEnabled: config.airQualityEnabled || false,
          timezone: loc.timezone || this.systemTimeZone,
          isImperial: config.isImperial || false
        });
        if (data.weather) {
          await this.processWeatherData(data.weather, folderName);
        }
        if (data.hourly) {
          await this.processForecastHoursData(data.hourly, folderName);
        }
        if (data.air) {
          await this.processAirQualityData(data.air, folderName);
        }
      }
    } catch (error) {
      this.log.error(`Abruf fehlgeschlagen: ${error.message}`);
    }
  }
  async processWeatherData(data, locationPath) {
    var _a;
    const t = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
    if (data.current) {
      const isDay = data.current.is_day;
      const root = `${locationPath}.weather.current`;
      if (typeof data.current.temperature_2m === "number" && typeof data.current.relative_humidity_2m === "number") {
        const dp = this.calculateDewPoint(data.current.temperature_2m, data.current.relative_humidity_2m);
        await this.extendOrCreateState(`${root}.dew_point_2m`, dp, "dew_point_2m");
      }
      for (const key in data.current) {
        let val = data.current[key];
        if (key === "time" && typeof val === "string") {
          val = new Date(val).toLocaleString(this.systemLang, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: this.systemLang === "en"
          });
        }
        await this.extendOrCreateState(`${root}.${key}`, val, key);
        if (key === "weather_code") {
          await this.createCustomState(`${root}.weather_text`, t.codes[val] || "?", "string", "text", "");
          await this.createCustomState(
            `${root}.icon_url`,
            `/adapter/${this.name}/icons/${val}${isDay === 1 ? "" : "n"}.png`,
            "string",
            "url",
            ""
          );
        }
        if (key === "wind_direction_10m" && typeof val === "number") {
          await this.createCustomState(
            `${root}.wind_direction_text`,
            this.getWindDirection(val),
            "string",
            "text",
            ""
          );
          await this.createCustomState(
            `${root}.wind_direction_icon`,
            this.getWindDirectionIcon(val),
            "string",
            "url",
            ""
          );
        }
        if (key === "wind_gusts_10m" && typeof val === "number") {
          await this.createCustomState(
            `${root}.wind_gust_icon`,
            this.getWindGustIcon(val),
            "string",
            "url",
            ""
          );
        }
      }
    }
    if (data.daily) {
      for (let i = 0; i < (((_a = data.daily.time) == null ? void 0 : _a.length) || 0); i++) {
        const dayPath = `${locationPath}.weather.forecast.day${i}`;
        for (const key in data.daily) {
          let val = data.daily[key][i];
          if (key === "time" && typeof val === "string") {
            val = new Date(val).toLocaleDateString(this.systemLang, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
          }
          if (key === "sunshine_duration" && typeof val === "number") {
            val = parseFloat((val / 3600).toFixed(2));
          }
          if ((key === "sunrise" || key === "sunset") && typeof val === "string") {
            val = new Date(val).toLocaleTimeString(this.systemLang, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: this.systemLang === "en"
            });
          }
          await this.extendOrCreateState(`${dayPath}.${key}`, val, key);
          if (key === "wind_direction_10m_dominant" && typeof val === "number") {
            await this.createCustomState(
              `${dayPath}.wind_direction_text`,
              this.getWindDirection(val),
              "string",
              "text",
              ""
            );
            await this.createCustomState(
              `${dayPath}.wind_direction_icon`,
              this.getWindDirectionIcon(val),
              "string",
              "url",
              ""
            );
          }
          if (key === "wind_gusts_10m_max" && typeof val === "number") {
            await this.createCustomState(
              `${dayPath}.wind_gust_icon`,
              this.getWindGustIcon(val),
              "string",
              "url",
              ""
            );
          }
          if (key === "weather_code") {
            await this.createCustomState(
              `${dayPath}.weather_text`,
              t.codes[val] || "?",
              "string",
              "text",
              ""
            );
            await this.createCustomState(
              `${dayPath}.icon_url`,
              `/adapter/${this.name}/icons/${val}.png`,
              "string",
              "url",
              ""
            );
          }
        }
      }
    }
  }
  async processForecastHoursData(data, locationPath) {
    const t = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
    const config = this.config;
    const hoursPerDayLimit = parseInt(config.forecastHours) || 24;
    if (data.hourly && data.hourly.time) {
      for (let i = 0; i < data.hourly.time.length; i++) {
        const dayNum = Math.floor(i / 24);
        const hourInDay = i % 24;
        if (hourInDay < hoursPerDayLimit) {
          const hourPath = `${locationPath}.weather.forecast.hourly.day${dayNum}.hour${hourInDay}`;
          for (const key in data.hourly) {
            let val = data.hourly[key][i];
            if (key === "time" && typeof val === "string") {
              val = new Date(val).toLocaleString(this.systemLang, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: this.systemLang === "en"
              });
            }
            if (key === "sunshine_duration" && typeof val === "number") {
              val = parseFloat((val / 3600).toFixed(2));
            }
            await this.extendOrCreateState(`${hourPath}.${key}`, val, key);
            if (key === "weather_code") {
              await this.createCustomState(
                `${hourPath}.weather_text`,
                t.codes[val] || "?",
                "string",
                "text",
                ""
              );
              await this.createCustomState(
                `${hourPath}.icon_url`,
                `/adapter/${this.name}/icons/${val}.png`,
                "string",
                "url",
                ""
              );
            }
            if (key === "wind_direction_10m" && typeof val === "number") {
              await this.createCustomState(
                `${hourPath}.wind_direction_text`,
                this.getWindDirection(val),
                "string",
                "text",
                ""
              );
              await this.createCustomState(
                `${hourPath}.wind_direction_icon`,
                this.getWindDirectionIcon(val),
                "string",
                "url",
                ""
              );
            }
            if (key === "wind_gusts_10m" && typeof val === "number") {
              await this.createCustomState(
                `${hourPath}.wind_gust_icon`,
                this.getWindGustIcon(val),
                "string",
                "url",
                ""
              );
            }
          }
        }
      }
    }
  }
  async processAirQualityData(data, locationPath) {
    const t = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
    if (data.current) {
      const root = `${locationPath}.air.current`;
      for (const key in data.current) {
        let val = data.current[key];
        if (key === "time" && typeof val === "string") {
          val = new Date(val).toLocaleString(this.systemLang, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: this.systemLang === "en"
          });
        }
        await this.extendOrCreateState(`${root}.${key}`, val, key);
        if (key.includes("pollen")) {
          const valPollen = data.current[key];
          const pollenText = valPollen > 2 ? t.pollen.high : valPollen > 1 ? t.pollen.moderate : valPollen > 0 ? t.pollen.low : t.pollen.none;
          await this.createCustomState(`${root}.${key}_text`, pollenText, "string", "text", "");
        }
      }
    }
  }
  async createCustomState(id, val, type, role, unit) {
    await this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: this.getTranslation(id.split(".").pop() || id),
        type,
        role,
        read: true,
        write: false,
        unit
      },
      native: {}
    });
    await this.setStateAsync(id, { val, ack: true });
  }
  async extendOrCreateState(id, val, translationKey) {
    const config = this.config;
    let unit = "";
    const currentUnitMap = config.isImperial ? import_units.unitMapImperial : import_units.unitMapMetric;
    for (const k in currentUnitMap) {
      if (id.includes(k)) {
        unit = currentUnitMap[k];
        break;
      }
    }
    await this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: this.getTranslation(translationKey || id.split(".").pop() || id),
        type: typeof val,
        role: "value",
        read: true,
        write: false,
        unit
      },
      native: {}
    });
    await this.setStateAsync(id, { val, ack: true });
  }
  onUnload(callback) {
    if (this.updateInterval) {
      this.clearInterval(this.updateInterval);
    }
    callback();
  }
}
if (require.main !== module) {
  module.exports = (options) => new OpenMeteoWeather(options);
} else {
  new OpenMeteoWeather();
}
//# sourceMappingURL=main.js.map
