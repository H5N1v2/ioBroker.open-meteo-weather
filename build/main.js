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
var SunCalc = __toESM(require("suncalc"));
class OpenMeteoWeather extends utils.Adapter {
  updateInterval = void 0;
  systemLang = "de";
  systemTimeZone = "Europe/Berlin";
  // Cached values für Performance
  cachedTranslations = null;
  cachedUnitMap = null;
  cachedIsImperial = false;
  // Konstanten für Icon-Mapping
  WIND_DIRECTION_FILES = [
    "n.png",
    "no.png",
    "o.png",
    "so.png",
    "s.png",
    "sw.png",
    "w.png",
    "nw.png"
  ];
  MOON_PHASE_ICONS = {
    new_moon: "nm.png",
    waxing_crescent: "zsm.png",
    first_quarter: "ev.png",
    waxing_gibbous: "zdm.png",
    full_moon: "vm.png",
    waning_gibbous: "adm.png",
    last_quarter: "lv.png",
    waning_crescent: "asm.png"
  };
  // Initialisiert die Basisklasse des Adapters
  constructor(options = {}) {
    super({ ...options, name: "open-meteo-weather" });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  // Holt die passende Übersetzung für Objektnamen aus den i18n Dateien
  getTranslation(key) {
    var _a, _b;
    if (!import_i18n.translations) {
      return key;
    }
    return ((_a = import_i18n.translations[this.systemLang]) == null ? void 0 : _a[key]) || ((_b = import_i18n.translations.en) == null ? void 0 : _b[key]) || key;
  }
  // Wandelt Gradzahlen in Himmelsrichtungen als Text um
  getWindDirection(deg) {
    const directions = this.cachedTranslations.dirs || ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  }
  // Liefert den Pfad zum passenden Icon für die Windrichtung
  getWindDirectionIcon(deg) {
    const index = Math.round(deg / 45) % 8;
    return `/adapter/${this.name}/icons/wind_direction_icons/${this.WIND_DIRECTION_FILES[index]}`;
  }
  // Ermittelt basierend auf der Mondphase das passende Icon
  getMoonPhaseIcon(phaseKey) {
    const fileName = this.MOON_PHASE_ICONS[phaseKey] || "nm.png";
    return `/adapter/${this.name}/icons/moon_phases/${fileName}`;
  }
  // Ermittelt basierend auf der Windgeschwindigkeit das passende Warn-Icon
  getWindGustIcon(gusts) {
    const factor = this.cachedIsImperial ? 1.60934 : 1;
    if (gusts < 39 / factor) {
      return `/adapter/${this.name}/icons/wind_icons/z.png`;
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
  // Errechnet den Taupunkt unter Berücksichtigung der eingestellten Maßeinheit
  calculateDewPoint(temp, humidity) {
    const t = this.cachedIsImperial ? (temp - 32) * 5 / 9 : temp;
    const rh = humidity / 100;
    const a = 17.625;
    const b = 243.04;
    const alpha = Math.log(rh) + a * t / (b + t);
    let dewPoint = b * alpha / (a - alpha);
    if (this.cachedIsImperial) {
      dewPoint = dewPoint * 9 / 5 + 32;
    }
    return parseFloat(dewPoint.toFixed(1));
  }
  // Setzt die Grundeinstellungen beim Start und startet den Update-Zyklus
  async onReady() {
    this.log.debug("onReady: Adapter starting...");
    try {
      const sysConfig = await this.getForeignObjectAsync("system.config");
      if (sysConfig && sysConfig.common) {
        this.systemLang = sysConfig.common.language || "de";
        this.systemTimeZone = sysConfig.common.timezone || "Europe/Berlin";
        this.log.debug(`onReady: System language: ${this.systemLang}, Timezone: ${this.systemTimeZone}`);
      }
      const config2 = this.config;
      this.cachedIsImperial = config2.isImperial || false;
      this.cachedUnitMap = this.cachedIsImperial ? import_units.unitMapImperial : import_units.unitMapMetric;
      this.cachedTranslations = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
      await this.cleanupDeletedLocations();
    } catch (err) {
      this.log.error(`Initialisierung fehlgeschlagen: ${err.message}`);
    }
    await this.updateData();
    const config = this.config;
    const minutes = parseInt(config.updateInterval) || 30;
    const intervalMs = minutes * 6e4;
    this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
    this.log.debug(`onReady: Scheduled update every ${minutes} minutes.`);
  }
  async cleanupDeletedLocations() {
    this.log.debug("cleanupDeletedLocations: Starting cleanup check...");
    const config = this.config;
    const locations = config.locations || [];
    const validFolders = new Set(locations.map((loc) => loc.name.replace(/[^a-zA-Z0-9]/g, "_")));
    const forecastDays = parseInt(config.forecastDays) || 1;
    const forecastHoursEnabled = config.forecastHoursEnabled || false;
    const airQualityEnabled = config.airQualityEnabled || false;
    const hoursLimit = parseInt(config.forecastHours) || 24;
    const allObjects = await this.getAdapterObjectsAsync();
    let deletedCount = 0;
    for (const objId in allObjects) {
      const parts = objId.split(".");
      if (parts.length > 2) {
        const folderName = parts[2];
        if (!validFolders.has(folderName)) {
          this.log.info(`L\xF6sche veralteten Standort: ${folderName}`);
          await this.delObjectAsync(objId, { recursive: true });
          deletedCount++;
          continue;
        }
        if (!airQualityEnabled && objId.includes(`${folderName}.air`)) {
          await this.delObjectAsync(objId, { recursive: true });
          deletedCount++;
          continue;
        }
        if (!forecastHoursEnabled && objId.includes(`${folderName}.weather.forecast.hourly`)) {
          await this.delObjectAsync(objId, { recursive: true });
          deletedCount++;
          continue;
        }
        if (forecastHoursEnabled && objId.includes(".hourly.day")) {
          const hourlyDayMatch = objId.match(/\.hourly\.day(\d+)/);
          if (hourlyDayMatch) {
            const hDayNum = parseInt(hourlyDayMatch[1]);
            if (hDayNum >= forecastDays) {
              await this.delObjectAsync(objId, { recursive: true });
              deletedCount++;
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
              deletedCount++;
              continue;
            }
          }
        }
        if (forecastHoursEnabled && objId.includes(".hourly.next_hours.hour")) {
          const hourMatch = objId.match(/\.hour(\d+)/);
          if (hourMatch) {
            const hourNum = parseInt(hourMatch[1]);
            if (hourNum >= hoursLimit) {
              await this.delObjectAsync(objId, { recursive: true });
              deletedCount++;
              continue;
            }
          }
        }
      }
    }
    this.log.debug(`cleanupDeletedLocations: Finished. Objects deleted: ${deletedCount}`);
  }
  // Steuert den Abruf der Wetterdaten und verteilt sie an die Verarbeitungsfunktionen
  async updateData() {
    this.log.debug("updateData: Starting data fetch for all locations...");
    try {
      const config = this.config;
      const locations = config.locations;
      if (!locations || !Array.isArray(locations) || locations.length === 0) {
        this.log.warn("Keine Standorte konfiguriert.");
        return;
      }
      for (const loc of locations) {
        const folderName = loc.name.replace(/[^a-zA-Z0-9]/g, "_");
        this.log.debug(`updateData: Fetching data for ${loc.name} (${loc.latitude}/${loc.longitude})`);
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
          this.log.debug(`updateData: Processing weather for ${folderName}`);
          await this.processWeatherData(data.weather, folderName, loc.latitude, loc.longitude);
        }
        if (data.hourly) {
          this.log.debug(`updateData: Processing hourly forecast for ${folderName}`);
          await this.processForecastHoursData(data.hourly, folderName);
        }
        if (data.air) {
          this.log.debug(`updateData: Processing air quality for ${folderName}`);
          await this.processAirQualityData(data.air, folderName);
        }
      }
      this.log.debug("updateData: All locations processed successfully.");
    } catch (error) {
      this.log.error(`Abruf fehlgeschlagen: ${error.message}`);
    }
  }
  // Verarbeitet aktuelle Wetterdaten sowie die tägliche Vorhersage inkl. lokaler Monddaten
  async processWeatherData(data, locationPath, lat, lon) {
    var _a;
    const t = this.cachedTranslations;
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
            `/adapter/${this.name}/icons/weather_icons/${val}${isDay === 1 ? "" : "n"}.png`,
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
        const forecastDate = new Date(data.daily.time[i]);
        const moonTimes = SunCalc.getMoonTimes(forecastDate, lat, lon);
        const moonIllumination = SunCalc.getMoonIllumination(forecastDate);
        const mRise = moonTimes.rise ? moonTimes.rise.toLocaleTimeString(this.systemLang, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: this.systemLang === "en"
        }) : "--:--";
        const mSet = moonTimes.set ? moonTimes.set.toLocaleTimeString(this.systemLang, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: this.systemLang === "en"
        }) : "--:--";
        await this.createCustomState(`${dayPath}.moonrise`, mRise, "string", "value", "");
        await this.createCustomState(`${dayPath}.moonset`, mSet, "string", "value", "");
        const phaseValue = moonIllumination.phase;
        let phaseKey = "new_moon";
        if (phaseValue >= 0.03 && phaseValue < 0.22) {
          phaseKey = "waxing_crescent";
        } else if (phaseValue >= 0.22 && phaseValue < 0.28) {
          phaseKey = "first_quarter";
        } else if (phaseValue >= 0.28 && phaseValue < 0.47) {
          phaseKey = "waxing_gibbous";
        } else if (phaseValue >= 0.47 && phaseValue < 0.53) {
          phaseKey = "full_moon";
        } else if (phaseValue >= 0.53 && phaseValue < 0.72) {
          phaseKey = "waning_gibbous";
        } else if (phaseValue >= 0.72 && phaseValue < 0.78) {
          phaseKey = "last_quarter";
        } else if (phaseValue >= 0.78 && phaseValue < 0.97) {
          phaseKey = "waning_crescent";
        }
        const phaseText = t.moon_phases ? t.moon_phases[phaseKey] : phaseKey;
        await this.createCustomState(`${dayPath}.moon_phase_text`, phaseText, "string", "text", "");
        await this.createCustomState(
          `${dayPath}.moon_phase_val`,
          parseFloat(phaseValue.toFixed(2)),
          "number",
          "value",
          ""
        );
        await this.createCustomState(
          `${dayPath}.moon_phase_icon`,
          this.getMoonPhaseIcon(phaseKey),
          "string",
          "url",
          ""
        );
        const nameDay = i === 0 ? new Intl.RelativeTimeFormat(this.systemLang, { numeric: "auto" }).format(0, "day") : forecastDate.toLocaleDateString(this.systemLang, { weekday: "long" });
        await this.createCustomState(`${dayPath}.name_day`, nameDay, "string", "text", "");
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
              `/adapter/${this.name}/icons/weather_icons/${val}.png`,
              "string",
              "url",
              ""
            );
          }
        }
      }
    }
  }
  // Verarbeitet die stündlichen Vorhersagedaten
  async processForecastHoursData(data, locationPath) {
    const t = this.cachedTranslations;
    const config = this.config;
    const hoursPer_h_Limit = parseInt(config.forecastHours) || 24;
    if (data.hourly && data.hourly.time) {
      const isDay = data.hourly.is_day;
      for (let i = 0; i < data.hourly.time.length; i++) {
        const hourIn_h = i % 24;
        if (hourIn_h < hoursPer_h_Limit) {
          const hourPath = `${locationPath}.weather.forecast.hourly.next_hours.hour${hourIn_h}`;
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
              const currentIsDayh = isDay ? isDay[i] : 1;
              await this.createCustomState(
                `${hourPath}.icon_url`,
                `/adapter/${this.name}/icons/weather_icons/${val}${currentIsDayh === 1 ? "" : "n"}.png`,
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
  // Verarbeitet Daten zur Luftqualität und Pollenbelastung
  async processAirQualityData(data, locationPath) {
    const t = this.cachedTranslations;
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
  // Erstellt einen neuen Datenpunkt mit benutzerdefinierter Rolle und Einheit
  async createCustomState(id, val, type, role, unit) {
    var _a, _b;
    this.log.debug(`createCustomState: Updating state ${id} (role: ${role})`);
    const idParts = id.split(".");
    const lastPart = idParts[idParts.length - 1] || id;
    await this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: this.getTranslation(lastPart),
        type,
        role,
        read: true,
        unit: unit ? (_b = (_a = import_units.unitTranslations[this.systemLang]) == null ? void 0 : _a[unit]) != null ? _b : unit : unit,
        write: false
      },
      native: {}
    });
    await this.setStateAsync(id, { val, ack: true });
  }
  // Erstellt oder aktualisiert einen Datenpunkt und weist automatisch Einheiten zu
  async extendOrCreateState(id, val, translationKey) {
    var _a, _b;
    let unit = "";
    for (const k in this.cachedUnitMap) {
      if (id.includes(k)) {
        unit = this.cachedUnitMap[k];
        break;
      }
    }
    const displayUnit = unit ? (_b = (_a = import_units.unitTranslations[this.systemLang]) == null ? void 0 : _a[unit]) != null ? _b : unit : unit;
    this.log.debug(`extendOrCreateState: Updating state ${id} (unit: ${displayUnit})`);
    const idParts = id.split(".");
    const lastPart = idParts[idParts.length - 1] || id;
    await this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: this.getTranslation(translationKey || lastPart),
        type: typeof val,
        role: "value",
        read: true,
        write: false,
        unit: displayUnit
      },
      native: {}
    });
    await this.setStateAsync(id, { val, ack: true });
  }
  // Bereinigt Intervalle beim Beenden des Adapters
  onUnload(callback) {
    this.log.debug("onUnload: Cleaning up intervals.");
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
