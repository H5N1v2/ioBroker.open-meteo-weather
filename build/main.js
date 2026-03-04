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
  // Objekt-Caching für bereits erstellte States (verhindert redundante DB-Zugriffe)
  createdObjects = /* @__PURE__ */ new Set();
  // Update-Sperre um Überschneidungen zu verhindern
  isUpdating = false;
  // System-Koordinaten aus ioBroker-Systemkonfiguration
  systemLatitude = null;
  systemLongitude = null;
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
  getI18nObject(key) {
    const obj = {};
    for (const lang in import_i18n.translations) {
      obj[lang] = import_i18n.translations[lang][key] || import_i18n.translations.en[key] || key;
    }
    return obj;
  }
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
    const useDirect2 = this.config.isWinddirection_icon;
    const subFolder = useDirect2 ? "direct_2/" : "";
    return `/adapter/${this.name}/icons/wind_direction_icons/${subFolder}${this.WIND_DIRECTION_FILES[index]}`;
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
        const sysLat = sysConfig.common.latitude;
        const sysLon = sysConfig.common.longitude;
        if (sysLat != null && sysLat !== "" && sysLon != null && sysLon !== "") {
          this.systemLatitude = parseFloat(sysLat);
          this.systemLongitude = parseFloat(sysLon);
        }
        this.log.debug(`onReady: System language: ${this.systemLang}, Timezone: ${this.systemTimeZone}`);
      }
      await this.extendForeignObjectAsync(this.namespace, {
        type: "meta",
        common: {
          name: {
            en: "Open-Meteo Weather Service",
            de: "Open-Meteo Wetterdienst",
            pl: "Us\u0142uga pogodowa Open-Meteo",
            ru: "\u0421\u0435\u0440\u0432\u0438\u0441 \u043F\u043E\u0433\u043E\u0434\u044B Open-Meteo",
            it: "Servizio meteo Open-Meteo",
            es: "Servicio meteorol\xF3gico Open-Meteo",
            "zh-cn": "Open-Meteo \u5929\u6C14\u670D\u52A1",
            fr: "Service m\xE9t\xE9o Open-Meteo",
            pt: "Servi\xE7o meteorol\xF3gico Open-Meteo",
            nl: "Open-Meteo Weerdienst",
            uk: "\u0421\u0435\u0440\u0432\u0456\u0441 \u043F\u043E\u0433\u043E\u0434\u0438 Open-Meteo"
          },
          type: "meta.user"
        }
      });
      const config2 = this.config;
      this.cachedIsImperial = config2.isImperial || false;
      this.cachedUnitMap = this.cachedIsImperial ? import_units.unitMapImperial : import_units.unitMapMetric;
      this.cachedTranslations = import_words.weatherTranslations[this.systemLang] || import_words.weatherTranslations.de;
      await this.cleanupDeletedLocations();
      await this.setObjectNotExistsAsync("info", {
        type: "channel",
        common: {
          name: {
            en: "Information",
            de: "Information",
            pl: "Informacja",
            ru: "\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F",
            it: "Informazione",
            es: "Informaci\xF3n",
            "zh-cn": "\u4FE1\u606F",
            fr: "Information",
            pt: "Informa\xE7\xE3o",
            nl: "Informatie",
            uk: "\u0406\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u044F"
          }
        },
        native: {}
      });
      await this.extendObject("info.lastUpdate", {
        type: "state",
        common: {
          name: {
            en: "Last Update",
            de: "Letztes Update",
            pl: "Ostatnia aktualizacja",
            ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435",
            it: "Ultimo aggiornamento",
            es: "\xDAltima actualizaci\xF3n",
            "zh-cn": "\u6700\u540E\u66F4\u65B0",
            fr: "Derni\xE8re mise \xE0 jour",
            pt: "\xDAltima atualiza\xE7\xE3o",
            nl: "Laatste update",
            uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F"
          },
          type: "string",
          role: "date",
          read: true,
          write: false
        },
        native: {}
      });
    } catch (err) {
      this.log.error(`Initialization failed: ${err.message}`);
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
          this.log.info(`Delete outdated location:: ${folderName}`);
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
        if (objId.includes(`${folderName}.air.forecast.day`)) {
          const aqDayMatch = objId.match(/\.day(\d+)/);
          if (aqDayMatch) {
            const aqDayNum = parseInt(aqDayMatch[1]);
            const aqLimit = airQualityEnabled ? parseInt(config.airQualityForecastDays) || 0 : 0;
            if (aqDayNum >= aqLimit) {
              this.log.info(
                `Bereinige veralteten Luftqualit\xE4ts-Vorhersagetag: ${folderName}.air.forecast.day${aqDayNum}`
              );
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
    if (this.isUpdating) {
      this.log.warn("Update skipped: Previous update is still running.");
      return;
    }
    this.isUpdating = true;
    this.log.debug("updateData: Starting data fetch for all locations...");
    try {
      const config = this.config;
      const locations = config.locations;
      if (!locations || !Array.isArray(locations) || locations.length === 0) {
        this.log.warn("No locations configured.");
        return;
      }
      for (const loc of locations) {
        const folderName = loc.name.replace(/[^a-zA-Z0-9]/g, "_");
        await this.setObjectNotExistsAsync(folderName, {
          type: "device",
          common: {
            name: {
              en: "location",
              de: "Standort",
              ru: "\u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
              pt: "localiza\xE7\xE3o",
              nl: "locatie",
              fr: "emplacement",
              it: "posizione",
              es: "ubicaci\xF3n",
              pl: "lokalizacja",
              uk: "\u043C\u0456\u0441\u0446\u0435\u0437\u043D\u0430\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F",
              "zh-cn": "\u5730\u70B9"
            },
            desc: {
              en: "Your configured location",
              de: "Ihr konfigurierter Standort",
              ru: "\u0412\u0430\u0448\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
              pt: "Sua localiza\xE7\xE3o configurada",
              nl: "Uw geconfigureerde locatie",
              fr: "Votre emplacement configur\xE9",
              it: "La tua posizione configurata",
              es: "Su ubicaci\xF3n configurada",
              pl: "Twoja skonfigurowana lokalizacja",
              uk: "\u0412\u0430\u0448\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u0435 \u043C\u0456\u0441\u0446\u0435\u0437\u043D\u0430\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F",
              "zh-cn": "\u60A8\u914D\u7F6E\u7684\u4F4D\u7F6E"
            }
          },
          native: {}
        });
        let channels = [
          {
            id: "weather",
            name: {
              en: "Weather",
              de: "Wetter",
              pl: "Pogoda",
              ru: "\u041F\u043E\u0433\u043E\u0434\u0430",
              it: "Meteo",
              es: "Clima",
              "zh-cn": "\u5929\u6C14",
              fr: "M\xE9t\xE9o",
              pt: "Clima",
              nl: "Weer",
              uk: "\u041F\u043E\u0433\u043E\u0434\u0430"
            }
          },
          {
            id: "weather.current",
            name: {
              en: "Current weather",
              de: "Aktuelles Wetter",
              pl: "Aktualna pogoda",
              ru: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u043E\u0433\u043E\u0434\u0430",
              it: "Meteo attuale",
              es: "Clima actual",
              "zh-cn": "\u5F53\u524D\u5929\u6C14",
              fr: "M\xE9t\xE9o actuelle",
              pt: "Clima atual",
              nl: "Huidige weer",
              uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0430 \u043F\u043E\u0433\u043E\u0434\u0430"
            }
          },
          {
            id: "weather.forecast",
            name: {
              en: "Weather forecast",
              de: "Wettervorhersage",
              pl: "Prognoza pogody",
              ru: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 pogody",
              it: "Previsioni meteo",
              es: "Pron\xF3stico del tiempo",
              "zh-cn": "\u5929\u6C14\u9884\u62A5",
              fr: "Pr\xE9visions m\xE9t\xE9o",
              pt: "Previs\xE3o do tempo",
              nl: "Weersverwachting",
              uk: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u043F\u043E\u0433\u043E\u0434\u0438"
            }
          },
          {
            id: "air",
            name: {
              en: "Air quality",
              de: "Luftqualit\xE4t",
              pl: "Jako\u015B\u0107 powietrza",
              ru: "\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430",
              it: "Qualit\xE0 dell'aria",
              es: "Calidad del aire",
              "zh-cn": "\u7A7A\u6C14\u8D28\u91CF",
              fr: "Qualit\xE9 de l'air",
              pt: "Qualidade do ar",
              nl: "Luchtkwaliteit",
              uk: "\u042F\u043A\u0456\u0441\u0442\u044C \u043F\u043E\u0432\u0456\u0442\u0440\u044F"
            }
          },
          {
            id: "air.current",
            name: {
              en: "Current air quality",
              de: "Aktuelle Luftqualit\xE4t",
              pl: "Aktualna jako\u015B\u0107 powietrza",
              ru: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430",
              it: "Qualit\xE0 dell'aria attuale",
              es: "Calidad del aire actual",
              "zh-cn": "\u5F53\u524D\u7A7A\u6C14\u8D28\u91CF",
              fr: "Qualit\xE9 de l'air actuelle",
              pt: "Qualidade do ar atual",
              nl: "Huidige luchtkwaliteit",
              uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0430 \u044F\u043A\u0456\u0441\u0442\u044C \u043F\u043E\u0432\u0456\u0442\u0440\u044F"
            }
          },
          {
            id: "air.forecast",
            name: {
              en: "Air quality forecast",
              de: "Luftqualit\xE4ts-Vorhersage",
              pl: "Prognoza jako\u015Bci powietrza",
              ru: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0432\u043E\u0437\u0434\u0443\u0445\u0430",
              it: "Previsioni qualit\xE0 dell'aria",
              es: "Pron\xF3stico de calidad del aire",
              "zh-cn": "\u7A7A\u6C14\u8D28\u91CF\u9810\u5831",
              fr: "Pr\xE9visions qualit\xE9 de l'air",
              pt: "Previs\xE3o de qualidade do ar",
              nl: "Luchtkwaliteit verwachting",
              uk: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u044F\u043A\u043E\u0441\u0442\u0456 \u043F\u043E\u0432\u0456\u0442\u0440\u044F"
            }
          }
        ];
        if (!config.airQualityEnabled) {
          this.log.debug(`Skipping air quality channels for ${loc.name} because it is disabled in config`);
          channels = channels.filter((chan) => !chan.id.startsWith("air"));
        }
        for (const chan of channels) {
          await this.setObjectNotExistsAsync(`${folderName}.${chan.id}`, {
            type: "channel",
            common: { name: chan.name },
            native: {}
          });
        }
        let latitude = loc.latitude;
        let longitude = loc.longitude;
        const latMissing = loc.latitude == null || loc.latitude === "" || isNaN(Number(loc.latitude));
        const lonMissing = loc.longitude == null || loc.longitude === "" || isNaN(Number(loc.longitude));
        if (latMissing || lonMissing) {
          this.log.debug("longitude and/or latitude not set, try loading system configuration");
          if (this.systemLatitude != null && this.systemLongitude != null) {
            latitude = this.systemLatitude;
            longitude = this.systemLongitude;
            this.log.info(`Using system coordinates for location "${loc.name}": ${latitude}/${longitude}`);
          } else {
            this.log.error(
              "Please set the longitude and latitude manual in the adapter or in your system configuration!"
            );
            continue;
          }
        }
        this.log.debug(`updateData: Fetching data for ${loc.name} (${latitude}/${longitude})`);
        const data = await (0, import_api_caller.fetchAllWeatherData)(
          {
            latitude,
            longitude,
            forecastDays: config.forecastDays || 7,
            forecastHours: config.forecastHours || 1,
            forecastHoursEnabled: config.forecastHoursEnabled || false,
            airQualityEnabled: config.airQualityEnabled || false,
            airQualityForecastDays: parseInt(config.airQualityForecastDays) || 0,
            timezone: loc.timezone || this.systemTimeZone,
            isImperial: config.isImperial || false
          },
          this.log
        );
        if (data.weather) {
          this.log.debug(`updateData: Processing weather for ${folderName}`);
          await this.processWeatherData(data.weather, folderName, latitude, longitude);
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
      const now = /* @__PURE__ */ new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const timestamp = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
      await this.setState("info.lastUpdate", { val: timestamp, ack: true });
    } catch (error) {
      this.log.error(`Retrieval failed: ${error.message}`);
    } finally {
      this.isUpdating = false;
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
          const useNightBright = this.config.isNight_icon;
          const iconPath = isDay === 1 ? `/adapter/${this.name}/icons/weather_icons/${val}.png` : useNightBright ? `/adapter/${this.name}/icons/night_bright/${val}nh.png` : `/adapter/${this.name}/icons/night_dark/${val}n.png`;
          await this.createCustomState(`${root}.icon_url`, iconPath, "string", "url", "");
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
        const dayId = `day${i}`;
        const dayName = {
          en: `Day ${i}`,
          de: `Tag ${i}`,
          pl: `Dzie\u0144 ${i}`,
          ru: `\u0414\u0435\u043D\u044C ${i}`,
          it: `Giorno ${i}`,
          es: `D\xEDa ${i}`,
          "zh-cn": `\u7B2C ${i} \u5929`,
          fr: `Jour ${i}`,
          pt: `Dia ${i}`,
          nl: `Dag ${i}`,
          uk: `\u0414\u0435\u043D\u044C ${i}`
        };
        await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.${dayId}`, {
          type: "channel",
          common: { name: dayName },
          native: {}
        });
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
        let phaseKey = "";
        if (phaseValue < 0.02 || phaseValue > 0.98) {
          phaseKey = "new_moon";
        } else if (phaseValue >= 0.02 && phaseValue < 0.23) {
          phaseKey = "waxing_crescent";
        } else if (phaseValue >= 0.23 && phaseValue < 0.27) {
          phaseKey = "first_quarter";
        } else if (phaseValue >= 0.27 && phaseValue < 0.48) {
          phaseKey = "waxing_gibbous";
        } else if (phaseValue >= 0.48 && phaseValue < 0.52) {
          phaseKey = "full_moon";
        } else if (phaseValue >= 0.52 && phaseValue < 0.73) {
          phaseKey = "waning_gibbous";
        } else if (phaseValue >= 0.73 && phaseValue < 0.77) {
          phaseKey = "last_quarter";
        } else {
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
        const nameDay = forecastDate.toLocaleDateString(this.systemLang, { weekday: "long" });
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
      await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.hourly`, {
        type: "channel",
        common: {
          name: {
            en: "Hourly forecast",
            de: "St\xFCndliche Vorhersage",
            pl: "Prognoza godzinowa",
            ru: "\u041F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
            it: "Previsioni orarie",
            es: "Pron\xF3stico por hora",
            "zh-cn": "\u6BCF\u5C0F\u65F6\u9884\u62A5",
            fr: "Pr\xE9visions horaires",
            pt: "Previs\xE3o hor\xE1ria",
            nl: "Uurlijkse verwachting",
            uk: "\u041F\u043E\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437"
          }
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.hourly.next_hours`, {
        type: "channel",
        common: {
          name: {
            en: "Next hours",
            de: "Kommende Stunden",
            pl: "Najbli\u017Csze godziny",
            ru: "\u0411\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0447\u0430\u0441\u044B",
            it: "Prossime ore",
            es: "Pr\xF3ximas horas",
            "zh-cn": "\u63A5\u4E0B\u6765\u7684\u51E0\u5C0F\u65F6",
            fr: "Heures suivantes",
            pt: "Pr\xF3ximas horas",
            nl: "Komende uren",
            uk: "\u041D\u0430\u0439\u0431\u043B\u0438\u0436\u0447\u0456 \u0433\u043E\u0434\u0438\u043D\u0438"
          }
        },
        native: {}
      });
      for (let i = 0; i < data.hourly.time.length; i++) {
        if (i < hoursPer_h_Limit) {
          const hourPath = `${locationPath}.weather.forecast.hourly.next_hours.hour${i}`;
          await this.setObjectNotExistsAsync(hourPath, {
            type: "channel",
            common: {
              name: {
                en: `Hour ${i}`,
                de: `Stunde ${i}`,
                pl: `Godzina ${i}`,
                ru: `\u0427\u0430\u0441 ${i}`,
                it: `Ora ${i}`,
                es: `Hora ${i}`,
                "zh-cn": `\u5C0F\u65F6 ${i}`,
                fr: `Heure ${i}`,
                pt: `Hora ${i}`,
                nl: `Uur ${i}`,
                uk: `\u0413\u043E\u0434\u0438\u043D\u0430 ${i}`
              }
            },
            native: {}
          });
          for (const key in data.hourly) {
            let val = data.hourly[key][i];
            if (key === "time" && typeof val === "string") {
              const dateObj = new Date(val);
              const lang = this.systemLang || "de";
              const dateVal = dateObj.toLocaleDateString(lang, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              });
              await this.extendOrCreateState(`${hourPath}.date`, dateVal, "date");
              val = dateObj.toLocaleTimeString(this.systemLang, {
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
              const useNightBright = this.config.isNight_icon;
              const iconPathHourly = currentIsDayh === 1 ? `/adapter/${this.name}/icons/weather_icons/${val}.png` : useNightBright ? `/adapter/${this.name}/icons/night_bright/${val}nh.png` : `/adapter/${this.name}/icons/night_dark/${val}n.png`;
              await this.createCustomState(`${hourPath}.icon_url`, iconPathHourly, "string", "url", "");
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
    const config = this.config;
    const aqForecastDays = parseInt(config.airQualityForecastDays) || 0;
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
          const pollenText = this.mapPollenToText(val, t, key);
          await this.createCustomState(`${root}.${key}_text`, pollenText, "string", "text", "");
        }
      }
    }
    if (data.hourly && data.hourly.time && aqForecastDays > 0) {
      for (let day = 0; day < aqForecastDays; day++) {
        const dayPath = `${locationPath}.air.forecast.day${day}`;
        const dayName = {
          en: `Day ${day}`,
          de: `Tag ${day}`,
          pl: `Dzie\u0144 ${day}`,
          ru: `\u0414\u0435\u043D\u044C ${day}`,
          it: `Giorno ${day}`,
          es: `D\xEDa ${day}`,
          "zh-cn": `\u7B2C ${day} \u5929`,
          fr: `Jour ${day}`,
          pt: `Dia ${day}`,
          nl: `Dag ${day}`,
          uk: `\u0414\u0435\u043D\u044C ${day}`
        };
        await this.setObjectNotExistsAsync(dayPath, {
          type: "channel",
          common: { name: dayName },
          native: {}
        });
        const startIdx = day * 24;
        const endIdx = startIdx + 24;
        const forecastDate = new Date(data.hourly.time[startIdx]);
        const nameDay = forecastDate.toLocaleDateString(this.systemLang, { weekday: "long" });
        const dayDate = forecastDate.toLocaleDateString(this.systemLang);
        await this.createCustomState(`${dayPath}.name_day`, nameDay, "string", "text", "");
        await this.createCustomState(`${dayPath}.date`, dayDate, "string", "value", "");
        for (const key in data.hourly) {
          if (key === "time") {
            continue;
          }
          const hourlyValues = data.hourly[key].slice(startIdx, endIdx);
          if (hourlyValues.length > 0) {
            const maxVal = Math.max(...hourlyValues);
            await this.extendOrCreateState(`${dayPath}.${key}_max`, maxVal, `${key}_max`);
            if (key.includes("pollen")) {
              const pollenText = this.mapPollenToText(maxVal, t, key);
              await this.createCustomState(`${dayPath}.${key}_text`, pollenText, "string", "text", "");
            }
          }
        }
      }
    }
  }
  mapPollenToText(val, t, key) {
    if (!t.pollen) {
      return val.toString();
    }
    const k = key || "";
    if (k.includes("mugwort") || k.includes("ragweed")) {
      return val > 20 ? t.pollen.high : val > 5 ? t.pollen.moderate : val > 0 ? t.pollen.low : t.pollen.none;
    }
    return val > 50 ? t.pollen.high : val > 10 ? t.pollen.moderate : val > 0 ? t.pollen.low : t.pollen.none;
  }
  // Erstellt einen neuen Datenpunkt mit benutzerdefinierter Rolle und Einheit
  async createCustomState(id, val, type, role, unit) {
    var _a, _b;
    if (!this.createdObjects.has(id)) {
      this.log.debug(`createCustomState: Creating state ${id} (role: ${role})`);
      const idParts = id.split(".");
      const lastPart = idParts[idParts.length - 1] || id;
      await this.setObjectNotExistsAsync(id, {
        type: "state",
        common: {
          name: this.getI18nObject(lastPart),
          type,
          role,
          read: true,
          unit: unit ? (_b = (_a = import_units.unitTranslations[this.systemLang]) == null ? void 0 : _a[unit]) != null ? _b : unit : unit,
          write: false
        },
        native: {}
      });
      this.createdObjects.add(id);
    }
    await this.setState(id, { val, ack: true });
  }
  // Erstellt oder aktualisiert einen Datenpunkt und weist automatisch Einheiten zu
  async extendOrCreateState(id, val, translationKey) {
    var _a, _b;
    if (!this.createdObjects.has(id)) {
      let unit = "";
      for (const k in this.cachedUnitMap) {
        if (id.includes(k)) {
          unit = this.cachedUnitMap[k];
          break;
        }
      }
      const displayUnit = unit ? (_b = (_a = import_units.unitTranslations[this.systemLang]) == null ? void 0 : _a[unit]) != null ? _b : unit : unit;
      this.log.debug(`extendOrCreateState: Creating state ${id} (unit: ${displayUnit})`);
      const idParts = id.split(".");
      const lastPart = idParts[idParts.length - 1] || id;
      const key = translationKey || lastPart;
      await this.setObjectNotExistsAsync(id, {
        type: "state",
        common: {
          name: this.getI18nObject(key),
          type: typeof val,
          role: "value",
          read: true,
          write: false,
          unit: displayUnit
        },
        native: {}
      });
      this.createdObjects.add(id);
    }
    await this.setState(id, { val, ack: true });
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
