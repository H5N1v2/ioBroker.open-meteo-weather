"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var pv_service_exports = {};
__export(pv_service_exports, {
  PVService: () => PVService
});
module.exports = __toCommonJS(pv_service_exports);
var import_pv_api = require("./pv-api");
var SunCalc = __toESM(require("suncalc"));
class PVService {
  adapter;
  apiCaller;
  updateInterval = null;
  astroTimeout = null;
  /**
   * Creates a new PV service instance.
   *
   * @param adapter The ioBroker adapter instance.
   */
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Initializes the PV service and starts the queries.
   */
  async init() {
    if (!this.adapter.config.pv_locations || this.adapter.config.pv_locations.length === 0) {
      this.adapter.log.warn("PV-Forecast: No locations configured.");
      return;
    }
    this.apiCaller = new import_pv_api.ApiCaller(this.adapter);
    this.adapter.log.info("Starting PV-Forecast Service...");
    this.adapter.config.pv_forecastHours = this.adapter.config.pv_forecastHours || 24;
    this.adapter.config.pv_forecastDays = this.adapter.config.pv_forecastDays || 7;
    await this.cleanupStaleObjects();
    await this.createStatesForLocations();
    await this.updateAllLocations();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.astroTimeout) {
      clearTimeout(this.astroTimeout);
      this.astroTimeout = null;
    }
    const configValue = this.adapter.config.pv_updateInterval;
    if (configValue === "sunrise") {
      this.adapter.getForeignObject("system.config", (err, obj) => {
        var _a, _b;
        if (err) {
          this.adapter.log.error(`System Check - Error reading config: ${err.message}`);
          return;
        }
        if (((_a = obj == null ? void 0 : obj.common) == null ? void 0 : _a.latitude) && ((_b = obj == null ? void 0 : obj.common) == null ? void 0 : _b.longitude)) {
          this.adapter.log.debug(
            `System Check for once before sunrise - Lat: ${obj.common.latitude}, Long: ${obj.common.longitude}`
          );
        } else {
          this.adapter.log.warn(
            "System Check for once before sunrise - Latitude/Longitude missing in ioBroker system settings!"
          );
        }
      });
    }
    if (configValue === "sunrise") {
      this.adapter.log.info("PV update scheduled: daily before sunrise");
      this.scheduleSunriseUpdate();
    } else {
      const intervalMinutes = Number(configValue || 60);
      if (intervalMinutes > 0) {
        this.adapter.log.info(`PV update scheduled: every ${intervalMinutes} minutes`);
        this.updateInterval = setInterval(
          () => {
            void this.updateAllLocations();
          },
          intervalMinutes * 60 * 1e3
        );
      }
    }
  }
  scheduleSunriseUpdate() {
    this.adapter.getForeignObject("system.config", (err, obj) => {
      if (err || !obj || !obj.common || obj.common.latitude === void 0) {
        this.adapter.log.error("PV-Service: Coordinates could not be read from system.config.");
        return;
      }
      const lat = obj.common.latitude;
      const lng = obj.common.longitude;
      const now = /* @__PURE__ */ new Date();
      try {
        const times = SunCalc.getTimes(now, lat, lng);
        let sunrise = times.sunrise;
        let targetTime = new Date(sunrise.getTime() - 15 * 60 * 1e3);
        if (targetTime <= now) {
          const tomorrow = /* @__PURE__ */ new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowTimes = SunCalc.getTimes(tomorrow, lat, lng);
          sunrise = tomorrowTimes.sunrise;
          targetTime = new Date(sunrise.getTime() - 15 * 60 * 1e3);
        }
        const msToWait = targetTime.getTime() - Date.now();
        this.adapter.log.info(
          `Next PV call-off planned for: ${targetTime.toLocaleString()} (Sunrise is at ${sunrise.toLocaleTimeString()})`
        );
        if (this.astroTimeout) {
          this.adapter.clearTimeout(this.astroTimeout);
        }
        this.astroTimeout = this.adapter.setTimeout(async () => {
          this.adapter.log.info("Scheduled PV update is being executed...");
          try {
            await this.updateAllLocations();
          } catch (error) {
            this.adapter.log.error(`Error during PV update: ${String(error)}`);
          }
          this.scheduleSunriseUpdate();
        }, msToWait);
      } catch (e) {
        this.adapter.log.error(`Error during astro calculation: ${String(e)}`);
      }
    });
  }
  async cleanupStaleObjects() {
    this.adapter.log.debug("Starting cleanup of stale objects...");
    const sumChannels = [
      { id: "sum_peak_locations_Daily", configKey: "locationsTotal_daily", masterKey: null },
      { id: "sum_peak_locations_Hourly", configKey: "locationsTotal_hourly", masterKey: null },
      { id: "sum_peak_locations_15_Minutely", configKey: "locationsTotal_minutely", masterKey: "minutes_15" }
    ];
    for (const channel of sumChannels) {
      const masterDisabled = channel.masterKey && !this.adapter.config[channel.masterKey];
      const sumOptionDisabled = !this.adapter.config[channel.configKey];
      const tooFewLocations = this.adapter.config.pv_locations.length <= 1;
      if (!this.adapter.config.locationsTotal || tooFewLocations || sumOptionDisabled || masterDisabled) {
        const sumObj = await this.adapter.getObjectAsync(channel.id);
        if (sumObj) {
          await this.adapter.delObjectAsync(channel.id, { recursive: true });
          this.adapter.log.info(`Cleanup: Deleted summary channel ${channel.id}`);
        }
      }
    }
    const configuredNames = new Set(
      this.adapter.config.pv_locations.map((l) => this.sanitizeLocationName(l.name))
    );
    const allObjects = await this.adapter.getAdapterObjectsAsync();
    for (const fullId of Object.keys(allObjects)) {
      const localId = fullId.replace(`${this.adapter.namespace}.`, "");
      const parts = localId.split(".");
      if (parts[0] !== "pv-forecast" || parts.length < 2) {
        continue;
      }
      const locName = parts[1];
      if (["sum_peak_locations_Daily", "sum_peak_locations_Hourly", "sum_peak_locations_15_Minutely"].includes(
        locName
      )) {
        continue;
      }
      if (!configuredNames.has(locName)) {
        if (parts.length === 2) {
          await this.adapter.delObjectAsync(localId, { recursive: true });
          this.adapter.log.info(`Cleanup: Deleted removed PV location: ${locName}`);
        }
        continue;
      }
      if (localId.includes(".hourly-forecast.hour") && localId.endsWith(".cloud_cover")) {
        if (!this.adapter.config.cloud_cover) {
          await this.adapter.delObjectAsync(localId);
          this.adapter.log.debug(`Cleanup: Removed disabled cloud_cover: ${localId}`);
          continue;
        }
      }
      if (localId.endsWith(".sunshine_duration")) {
        if (!this.adapter.config.sunshine_duration) {
          await this.adapter.delObjectAsync(localId);
          this.adapter.log.debug(`Cleanup: Removed disabled sunshine_duration: ${localId}`);
          continue;
        }
      }
      if (localId.includes(".15-min-forecast") && !this.adapter.config.minutes_15) {
        await this.adapter.delObjectAsync(localId, { recursive: true });
        continue;
      }
      const dayMatch = localId.match(/\.daily-forecast\.day(\d+)$/);
      if (dayMatch) {
        const dayIndex = parseInt(dayMatch[1]);
        if (dayIndex >= this.adapter.config.forecastDays) {
          await this.adapter.delObjectAsync(localId, { recursive: true });
          continue;
        }
      }
      const hourMatch = localId.match(/\.hourly-forecast\.hour(\d+)$/);
      if (hourMatch) {
        const hourIndex = parseInt(hourMatch[1]);
        if (hourIndex >= (this.adapter.config.pv_forecastHours || 24)) {
          await this.adapter.delObjectAsync(localId, { recursive: true });
          continue;
        }
      }
      if (localId.endsWith(".15-min-json_chart") && !this.adapter.config.minutes_15_json) {
        await this.adapter.delObjectAsync(localId);
        continue;
      }
      if (localId.endsWith(".hourly-json_chart") && !this.adapter.config.hours_json) {
        await this.adapter.delObjectAsync(localId);
        continue;
      }
    }
    if (!this.adapter.config.locationsTotal_minutely_json || !this.adapter.config.minutes_15 || this.adapter.config.pv_locations.length <= 1) {
      const jsonObj = await this.adapter.getObjectAsync("pv-forecast.sum_peak_15-min-json_chart");
      if (jsonObj) {
        await this.adapter.delObjectAsync("pv-forecast.sum_peak_15-min-json_chart");
      }
    }
    this.adapter.log.debug("Cleanup finished.");
  }
  async createStatesForLocations() {
    await this.adapter.extendObjectAsync("info.lastUpdate_PV_Forecast", {
      type: "state",
      common: {
        name: {
          en: "Last Update PV Forecast",
          de: "Letztes Update PV-Vorhersage",
          pl: "Ostatnia aktualizacja prognozy PV",
          ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0430 PV",
          it: "Ultimo aggiornamento previsione PV",
          es: "\xDAltima actualizaci\xF3n pron\xF3stico PV",
          "zh-cn": "\u6700\u540E\u66F4\u65B0 PV \u9884\u6D4B",
          fr: "Derni\xE8re mise \xE0 jour pr\xE9vision PV",
          pt: "\xDAltima atualiza\xE7\xE3o previs\xE3o PV",
          nl: "Laatste update PV-voorspelling",
          uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0443 PV"
        },
        type: "string",
        role: "date",
        read: true,
        write: false
      },
      native: {}
    });
    await this.adapter.setObjectNotExistsAsync("pv-forecast", {
      type: "channel",
      common: { name: "PV Forecast" },
      role: "info",
      native: {}
    });
    for (const location of this.adapter.config.pv_locations) {
      const locationName = `${this.sanitizeLocationName(location.name)}`;
      const base = `pv-forecast.${locationName}`;
      await this.adapter.setObjectNotExistsAsync(base, {
        type: "device",
        common: { name: location.name },
        native: {}
      });
      await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast`, {
        type: "channel",
        common: {
          name: {
            en: "Hourly Forecast",
            de: "St\xFCndliche Vorhersage",
            ru: "\u041F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
            pt: "Previs\xE3o hor\xE1ria",
            nl: "Uurlijkse voorspelling",
            fr: "Pr\xE9visions horaires",
            it: "Previsioni orarie",
            es: "Pron\xF3stico por hora",
            pl: "Prognoza godzinowa",
            uk: "\u041F\u043E\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
            "zh-cn": "\u9010\u5C0F\u65F6\u9884\u62A5"
          }
        },
        native: {}
      });
      for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}`, {
          type: "channel",
          common: {
            name: {
              en: `Hour ${hour}`,
              de: `Stunde ${hour}`,
              ru: `\u0427\u0430\u0441 ${hour}`,
              pt: `Hora ${hour}`,
              nl: `Uur ${hour}`,
              fr: `Heure ${hour}`,
              it: `Ora ${hour}`,
              es: `Hora ${hour}`,
              pl: `Godzina ${hour}`,
              uk: `\u0413\u043E\u0434\u0438\u043D\u0430 ${hour}`,
              "zh-cn": `\u5C0F\u65F6 ${hour}`
            }
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.time`, {
          type: "state",
          common: {
            name: {
              en: "Hour Time",
              de: "Stundenzeit",
              ru: "\u0427\u0430\u0441 \u0412\u0440\u0435\u043C\u044F",
              pt: "Hora",
              nl: "Uur Tijd",
              fr: "Heure",
              it: "Ora Ora",
              es: "Hora Tiempo",
              pl: "Godzina Czas",
              uk: "\u0413\u043E\u0434\u0438\u043D\u0430 \u0427\u0430\u0441",
              "zh-cn": "\u5C0F\u65F6"
            },
            type: "string",
            role: "date",
            read: true,
            write: false
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.unix_time_stamp`, {
          type: "state",
          common: {
            name: {
              en: "Unix Time Stamp",
              de: "Unix-Zeitstempel",
              ru: "Unix-\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043C\u0435\u0442\u043A\u0430",
              pt: "Carimbo de tempo Unix",
              nl: "Unix-tijdstempel",
              fr: "Horodatage Unix",
              it: "Timestamp Unix",
              es: "Marca de tiempo Unix",
              pl: "Znacznik czasu Unix",
              uk: "Unix-\u043C\u0456\u0442\u043A\u0430 \u0447\u0430\u0441\u0443",
              "zh-cn": "Unix\u65F6\u95F4\u6233"
            },
            type: "number",
            role: "value.time",
            read: true,
            write: false
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(
          `${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`,
          {
            type: "state",
            common: {
              name: {
                en: "Global Tilted Irradiance",
                de: "Globale Strahlung auf geneigter Fl\xE4che",
                ru: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u0430\u044F \u043D\u0430\u043A\u043B\u043E\u043D\u043D\u0430\u044F \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u043D\u043E\u0441\u0442\u044C",
                pt: "Irradi\xE2ncia Global Inclinada",
                nl: "Globale gekantelde instraling",
                fr: "Irradiance globale inclin\xE9e",
                it: "Irradianza inclinata globale",
                es: "Irradiancia global inclinada",
                pl: "Globalne pochylone nat\u0119\u017Cenie promieniowania",
                uk: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u0435 \u043D\u0430\u0445\u0438\u043B\u0435\u043D\u0435 \u0432\u0438\u043F\u0440\u043E\u043C\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F",
                "zh-cn": "\u5168\u7403\u503E\u659C\u8F90\u7167\u5EA6"
              },
              type: "number",
              role: "value.energy",
              unit: "Wh",
              read: true,
              write: false
            },
            native: {}
          }
        );
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.temperature_2m`, {
          type: "state",
          common: {
            name: {
              en: "Temperature 2m",
              de: "Temperatur 2 m",
              ru: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 2 \u043C",
              pt: "Temperatura 2m",
              nl: "Temperatuur 2m",
              fr: "Temp\xE9rature 2m",
              it: "Temperatura 2m",
              es: "Temperatura 2m",
              pl: "Temperatura 2m",
              uk: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 2 \u043C",
              "zh-cn": "\u6E29\u5EA6 2 \u7C73"
            },
            type: "number",
            role: "value.temperature",
            unit: "\xB0C",
            read: true,
            write: false
          },
          native: {}
        });
        if (this.adapter.config.cloud_cover) {
          await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.cloud_cover`, {
            type: "state",
            common: {
              name: {
                en: "Cloud Cover",
                de: "Wolkenbedeckung",
                ru: "\u041E\u0431\u043B\u0430\u0447\u043D\u043E\u0441\u0442\u044C",
                pt: "Cobertura de nuvens",
                nl: "Bewolking",
                fr: "Couverture nuageuse",
                it: "Copertura nuvolosa",
                es: "Cobertura de nubes",
                pl: "Zachmurzenie",
                uk: "\u0425\u043C\u0430\u0440\u043D\u0438\u0439 \u043F\u043E\u043A\u0440\u0438\u0432",
                "zh-cn": "\u4E91\u5C42\u8986\u76D6"
              },
              type: "number",
              role: "value.clouds",
              unit: "%",
              read: true,
              write: false
            },
            native: {}
          });
        }
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.wind_speed_10m`, {
          type: "state",
          common: {
            name: {
              en: "Wind Speed 10m",
              de: "Windgeschwindigkeit 10 m",
              ru: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u0435\u0442\u0440\u0430 10 \u043C",
              pt: "Velocidade do vento 10m",
              nl: "Windsnelheid 10 m",
              fr: "Vitesse du vent 10 m",
              it: "Velocit\xE0 del vento 10 m",
              es: "Velocidad del viento 10m",
              pl: "Pr\u0119dko\u015B\u0107 wiatru 10m",
              uk: "\u0428\u0432\u0438\u0434\u043A\u0456\u0441\u0442\u044C \u0432\u0456\u0442\u0440\u0443 10 \u043C",
              "zh-cn": "\u98CE\u901F 10 \u7C73"
            },
            type: "number",
            role: "value.speed.wind",
            unit: "km/h",
            read: true,
            write: false
          },
          native: {}
        });
        if (this.adapter.config.sunhine_duration) {
          await this.adapter.setObjectNotExistsAsync(
            `${base}.hourly-forecast.hour${hour}.sunshine_duration`,
            {
              type: "state",
              common: {
                name: {
                  en: "Sunshine Duration",
                  de: "Sonnenscheindauer",
                  ru: "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u043E\u0433\u043E \u0441\u0438\u044F\u043D\u0438\u044F",
                  pt: "Dura\xE7\xE3o da luz solar",
                  nl: "Zonneschijnduur",
                  fr: "Dur\xE9e d'ensoleillement",
                  it: "Durata del sole",
                  es: "Duraci\xF3n de la luz solar",
                  pl: "Czas trwania nas\u0142onecznienia",
                  uk: "\u0422\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C \u0441\u043E\u043D\u044F\u0447\u043D\u043E\u0433\u043E \u0441\u0432\u0456\u0442\u043B\u0430",
                  "zh-cn": "\u65E5\u7167\u65F6\u957F"
                },
                type: "number",
                role: "value",
                unit: "min",
                read: true,
                write: false
              },
              native: {}
            }
          );
        }
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.pv_temperature`, {
          type: "state",
          common: {
            name: {
              en: "Estimated PV Module Temperature",
              de: "Gesch\xE4tzte PV-Modultemperatur",
              ru: "\u0420\u0430\u0441\u0447\u0435\u0442\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0444\u043E\u0442\u043E\u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043C\u043E\u0434\u0443\u043B\u044F",
              pt: "Temperatura estimada do m\xF3dulo fotovoltaico",
              nl: "Geschatte temperatuur van de PV-module",
              fr: "Temp\xE9rature estim\xE9e du module PV",
              it: "Temperatura stimata del modulo fotovoltaico",
              es: "Temperatura estimada del m\xF3dulo fotovoltaico",
              pl: "Szacowana temperatura modu\u0142u fotowoltaicznego",
              uk: "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043A\u043E\u0432\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0444\u043E\u0442\u043E\u0435\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u043C\u043E\u0434\u0443\u043B\u044F",
              "zh-cn": "\u5149\u4F0F\u7EC4\u4EF6\u9884\u4F30\u6E29\u5EA6"
            },
            type: "number",
            role: "value.temperature",
            unit: "\xB0C",
            read: true,
            write: false
          },
          native: {}
        });
      }
      await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast`, {
        type: "channel",
        common: {
          name: {
            en: "Daily Forecast",
            de: "T\xE4gliche Prognose",
            ru: "\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
            pt: "Previs\xE3o di\xE1ria",
            nl: "Dagelijkse voorspelling",
            fr: "Pr\xE9vision quotidienne",
            it: "Previsione giornaliera",
            es: "Pron\xF3stico diario",
            pl: "Prognoza dzienna",
            uk: "\u0429\u043E\u0434\u0435\u043D\u043D\u0438\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
            "zh-cn": "\u6BCF\u65E5\u9884\u6D4B"
          }
        },
        native: {}
      });
      for (let day = 0; day < this.adapter.config.forecastDays; day++) {
        await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}`, {
          type: "channel",
          common: {
            name: {
              en: `Day ${day}`,
              de: `Tag ${day}`,
              ru: `\u0414\u0435\u043D\u044C ${day}`,
              pt: `Dia ${day}`,
              nl: `Dag ${day}`,
              fr: `Jour ${day}`,
              it: `Giorno ${day}`,
              es: `D\xEDa ${day}`,
              pl: `Dzie\u0144 ${day}`,
              uk: `\u0414\u0435\u043D\u044C ${day}`,
              "zh-cn": `\u5929 ${day}`
            }
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}.Date`, {
          type: "state",
          common: {
            name: {
              en: "Date",
              de: "Datum",
              ru: "\u0414\u0430\u0442\u0430",
              pt: "Data",
              nl: "Datum",
              fr: "Date",
              it: "Data",
              es: "Fecha",
              pl: "Data",
              uk: "\u0414\u0430\u0442\u0430",
              "zh-cn": "\u65E5\u671F"
            },
            type: "string",
            role: "text",
            read: true,
            write: false
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}.Peak_day`, {
          type: "state",
          common: {
            name: {
              en: "Daily Peak Energy",
              de: "T\xE4gliche Spitzenenergie",
              ru: "\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u043F\u0438\u043A \u044D\u043D\u0435\u0440\u0433\u0438\u0438",
              pt: "Energia de pico di\xE1ria",
              nl: "Dagelijkse piekenergie",
              fr: "\xC9nergie maximale quotidienne",
              it: "Energia di picco giornaliera",
              es: "Energ\xEDa m\xE1xima diaria",
              pl: "Dzienny szczyt energetyczny",
              uk: "\u0414\u043E\u0431\u043E\u0432\u0438\u0439 \u043F\u0456\u043A\u043E\u0432\u0438\u0439 \u0435\u043D\u0435\u0440\u0433\u043E\u0441\u043F\u043E\u0436\u0438\u0432\u0430\u043D\u043D\u044F",
              "zh-cn": "\u6BCF\u65E5\u5CF0\u503C\u80FD\u91CF"
            },
            type: "number",
            role: "value.energy",
            unit: "Wh",
            read: true,
            write: false
          },
          native: {}
        });
      }
      if (this.adapter.config.locationsTotal && this.adapter.config.pv_locations.length > 1) {
        const sumBase = "pv-forecast";
        await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Daily`, {
          type: "channel",
          common: {
            name: {
              en: "Sum Peak from Locations Daily",
              de: "T\xE4gliche Summe der Spitzenwerte von Standorten",
              ru: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0439 \u043F\u0438\u043A \u0438\u0437 \u0440\u0430\u0437\u043B\u0438\u0447\u043D\u044B\u0445 \u043C\u0435\u0441\u0442 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E",
              pt: "Pico de soma de locais di\xE1rios",
              nl: "Som van pieken van locaties dagelijks",
              fr: "Somme des pics quotidiens \xE0 partir des emplacements",
              it: "Somma Picco dalle Posizioni Giornaliere",
              es: "Suma de picos desde ubicaciones diarias",
              pl: "Sum Peak z lokalizacji dziennie",
              uk: "\u0421\u0443\u043C\u0430 \u041F\u0456\u043A \u0437 \u043C\u0456\u0441\u0446\u044C \u0440\u043E\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u043D\u043D\u044F \u0449\u043E\u0434\u043D\u044F",
              "zh-cn": "\u6BCF\u65E5\u4F4D\u7F6E\u7684 Sum Peak"
            }
          },
          native: {}
        });
        for (let day = 0; day < this.adapter.config.forecastDays; day++) {
          await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Daily.day${day}`, {
            type: "channel",
            common: {
              name: {
                en: `Day ${day}`,
                de: `Tag ${day}`,
                ru: `\u0414\u0435\u043D\u044C ${day}`,
                pt: `Dia ${day}`,
                nl: `Dag ${day}`,
                fr: `Jour ${day}`,
                it: `Giorno ${day}`,
                es: `D\xEDa ${day}`,
                pl: `Dzie\u0144 ${day}`,
                uk: `\u0414\u0435\u043D\u044C ${day}`,
                "zh-cn": `\u5929 ${day}`
              }
            },
            native: {}
          });
          await this.adapter.setObjectNotExistsAsync(
            `${sumBase}.sum_peak_locations_Daily.day${day}.sum_locations`,
            {
              type: "state",
              common: {
                name: {
                  en: "Sum of all locations",
                  de: "Summe aller Standorte",
                  ru: "\u0421\u0443\u043C\u043C\u0430 \u0432\u0441\u0435\u0445 \u043C\u0435\u0441\u0442",
                  pt: "Soma de todas as localiza\xE7\xF5es",
                  nl: "Som van alle locaties",
                  fr: "Somme de tous les emplacements",
                  it: "Somma di tutte le posizioni",
                  es: "Suma de todas las ubicaciones",
                  pl: "Suma wszystkich lokalizacji",
                  uk: "\u0421\u0443\u043C\u0430 \u0432\u0441\u0456\u0445 \u043C\u0456\u0441\u0446\u044C \u0440\u043E\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u043D\u043D\u044F",
                  "zh-cn": "\u6240\u6709\u4F4D\u7F6E\u7684\u603B\u548C"
                },
                type: "number",
                role: "value.energy",
                unit: "Wh",
                read: true,
                write: false
              },
              native: {}
            }
          );
        }
      }
      if (this.adapter.config.minutes_15) {
        await this.adapter.setObjectNotExistsAsync(`${base}.15-min-forecast`, {
          type: "channel",
          common: {
            name: {
              en: "15-Minute Forecast",
              de: "15-Minuten-Vorhersage",
              ru: "15-\u043C\u0438\u043D\u0443\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
              pt: "Previs\xE3o de 15 minutos",
              nl: "15-minutenvoorspelling",
              fr: "Pr\xE9visions \xE0 15 minutes",
              it: "Previsioni a 15 minuti",
              es: "Previsi\xF3n en 15 minutos",
              pl: "15-minutowa prognoza",
              uk: "15-\u0445\u0432\u0438\u043B\u0438\u043D\u043D\u0438\u0439 \u043F\u0440\u043E\u0433\u043D\u043E\u0437",
              "zh-cn": "15-Minute Forecast"
            }
          },
          native: {}
        });
        const states = {
          unix_time_stamp: {
            name: {
              en: "unix time stamp",
              de: "Unix-Zeitstempel",
              ru: "Unix-\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043C\u0435\u0442\u043A\u0430",
              pt: "Carimbo de tempo Unix",
              nl: "Unix-tijdstempel",
              fr: "Horodatage Unix",
              it: "Timestamp Unix",
              es: "Sello de tiempo Unix",
              pl: "Znacznik czasu Unix",
              uk: "Unix-\u043C\u0456\u0442\u043A\u0430 \u0447\u0430\u0441\u0443",
              "zh-cn": "Unix\u65F6\u95F4\u6233"
            },
            type: "number",
            role: "value.time",
            unit: ""
          },
          time: {
            name: {
              en: "formatted time",
              de: "Formatierte Zeit",
              ru: "\u041E\u0442\u0444\u043E\u0440\u043C\u0430\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F",
              pt: "Hora formatada",
              nl: "Opgemaakte tijd",
              fr: "Heure format\xE9e",
              it: "Ora formattata",
              es: "Hora formateada",
              pl: "Sformatowany czas",
              uk: "\u0412\u0456\u0434\u0444\u043E\u0440\u043C\u0430\u0442\u043E\u0432\u0430\u043D\u0438\u0439 \u0447\u0430\u0441",
              "zh-cn": "\u683C\u5F0F\u5316\u65F6\u95F4"
            },
            type: "string",
            role: "text",
            unit: ""
          },
          global_tilted_irradiance: {
            name: {
              en: "Irradiance",
              de: "Einstrahlung",
              ru: "\u041E\u0441\u0432\u0435\u0449\u0435\u043D\u043D\u043E\u0441\u0442\u044C",
              pt: "Irradi\xE2ncia",
              nl: "Straling",
              fr: "Irradiance",
              it: "Irradianza",
              es: "Irradiancia",
              pl: "Promieniowanie",
              uk: "\u041E\u043F\u0440\u043E\u043C\u0456\u043D\u0435\u043D\u043D\u044F",
              "zh-cn": "\u8F90\u7167\u5EA6"
            },
            type: "number",
            role: "value.energy",
            unit: "Wh"
          },
          temperature_2m: {
            name: {
              en: "Temperature",
              de: "Temperatur",
              ru: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
              pt: "Temperatura",
              nl: "Temperatuur",
              fr: "Temp\xE9rature",
              it: "Temperatura",
              es: "Temperatura",
              pl: "Temperatura",
              uk: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
              "zh-cn": "\u6E29\u5EA6"
            },
            type: "number",
            role: "value.temperature",
            unit: "\xB0C"
          },
          wind_speed_10m: {
            name: {
              en: "Wind speed",
              de: "Windgeschwindigkeit",
              ru: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u0435\u0442\u0440\u0430",
              pt: "Velocidade do vento",
              nl: "Windsnelheid",
              fr: "Vitesse du vent",
              it: "Velocit\xE0 del vento",
              es: "Velocidad del viento",
              pl: "Pr\u0119dko\u015B\u0107 wiatru",
              uk: "\u0428\u0432\u0438\u0434\u043A\u0456\u0441\u0442\u044C \u0432\u0456\u0442\u0440\u0443",
              "zh-cn": "\u98CE\u901F"
            },
            type: "number",
            role: "value.speed.wind",
            unit: "km/h"
          },
          sunshine_duration: {
            name: {
              en: "Sunshine duration",
              de: "Sonnenscheindauer",
              ru: "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u043E\u0433\u043E \u0441\u0438\u044F\u043D\u0438\u044F",
              pt: "Dura\xE7\xE3o da luz solar",
              nl: "Duur van de zonneschijn",
              fr: "Dur\xE9e d'ensoleillement",
              it: "Durata del sole",
              es: "Duraci\xF3n del sol",
              pl: "Czas nas\u0142onecznienia",
              uk: "\u0422\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C \u0441\u043E\u043D\u044F\u0447\u043D\u043E\u0433\u043E \u0441\u044F\u0439\u0432\u0430",
              "zh-cn": "Sunshine duration"
            },
            type: "number",
            role: "value",
            unit: "min"
          }
        };
        for (let i = 0; i < 96; i++) {
          const channelId = `pv-forecast.${locationName}.15-min-forecast.${i}`;
          await this.adapter.setObjectNotExistsAsync(channelId, {
            type: "channel",
            common: { name: `Interval ${i}` },
            native: {}
          });
          for (const [key, info] of Object.entries(states)) {
            const locationName2 = this.sanitizeLocationName(location.name);
            if (key === "sunshine_duration" && !this.adapter.config.sunshine_duration) {
              continue;
            }
            const base2 = `pv-forecast.${locationName2}`;
            await this.adapter.setObjectNotExistsAsync(`${channelId}.${key}`, {
              type: "state",
              common: {
                name: info.name,
                type: info.type,
                role: info.role,
                unit: info.unit,
                read: true,
                write: false
              },
              native: {}
            });
            await this.adapter.setObjectNotExistsAsync(`${base2}.15-min-forecast.${i}.pv_temperature`, {
              type: "state",
              common: {
                name: {
                  en: "Estimated PV Module Temperature",
                  de: "Gesch\xE4tzte PV-Modultemperatur",
                  ru: "\u0420\u0430\u0441\u0447\u0435\u0442\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0444\u043E\u0442\u043E\u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043C\u043E\u0434\u0443\u043B\u044F",
                  pt: "Temperatura estimada do m\xF3dulo fotovoltaico",
                  nl: "Geschatte temperatuur van de PV-module",
                  fr: "Temp\xE9rature estim\xE9e du module PV",
                  it: "Temperatura stimata del modulo fotovoltaico",
                  es: "Temperatura estimada del m\xF3dulo fotovoltaico",
                  pl: "Szacowana temperatura modu\u0142u fotowoltaicznego",
                  uk: "\u0420\u043E\u0437\u0440\u0430\u0445\u0443\u043D\u043A\u043E\u0432\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0444\u043E\u0442\u043E\u0435\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u043C\u043E\u0434\u0443\u043B\u044F",
                  "zh-cn": "\u5149\u4F0F\u7EC4\u4EF6\u9884\u4F30\u6E29\u5EA6"
                },
                type: "number",
                role: "value.temperature",
                unit: "\xB0C",
                read: true,
                write: false
              },
              native: {}
            });
          }
        }
      }
      if (this.adapter.config.minutes_15_json) {
        await this.adapter.setObjectNotExistsAsync(`${base}.15-min-json_chart`, {
          type: "state",
          common: {
            name: {
              en: "JSON Chart Data",
              de: "JSON-Diagrammdaten",
              ru: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON",
              pt: "Dados do gr\xE1fico JSON",
              nl: "JSON-grafiekgegevens",
              fr: "Donn\xE9es du graphique JSON",
              it: "Dati del grafico JSON",
              es: "Datos de gr\xE1ficos JSON",
              pl: "Dane wykresu JSON",
              uk: "\u0414\u0430\u043D\u0456 \u0434\u0456\u0430\u0433\u0440\u0430\u043C\u0438 JSON",
              "zh-cn": "JSON \u56FE\u8868\u6570\u636E"
            },
            type: "string",
            role: "json",
            read: true,
            write: false,
            desc: {
              en: "History data for eCharts in JSON format",
              de: "Verlaufsdaten f\xFCr eCharts im JSON-Format",
              ru: "\u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0434\u043B\u044F eCharts \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON",
              pt: "Dados hist\xF3ricos do eCharts em formato JSON",
              nl: "Historische gegevens voor eCharts in JSON-formaat.",
              fr: "Donn\xE9es historiques pour eCharts au format JSON",
              it: "Dati storici per eCharts in formato JSON",
              es: "Datos hist\xF3ricos de eCharts en formato JSON",
              pl: "Dane historyczne dla eCharts w formacie JSON",
              uk: "\u0406\u0441\u0442\u043E\u0440\u0438\u0447\u043D\u0456 \u0434\u0430\u043D\u0456 \u0434\u043B\u044F eCharts \u0443 \u0444\u043E\u0440\u043C\u0430\u0442\u0456 JSON",
              "zh-cn": "eCharts \u7684\u5386\u53F2\u6570\u636E\uFF08JSON \u683C\u5F0F\uFF09"
            }
          },
          native: {}
        });
      }
      if (this.adapter.config.hours_json) {
        await this.adapter.setObjectNotExistsAsync(`${base}.hourly-json_chart`, {
          type: "state",
          common: {
            name: {
              en: "JSON Chart Data Hours",
              de: "JSON-Diagrammdaten Stunden",
              ru: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON \u0427\u0430\u0441\u044B",
              pt: "Dados do gr\xE1fico JSON Horas",
              nl: "JSON-grafiekgegevens Uren",
              fr: "Donn\xE9es du graphique JSON Heures",
              it: "Dati del grafico JSON Ore",
              es: "Datos de gr\xE1ficos JSON Horas",
              pl: "Dane wykresu JSON Godziny",
              uk: "\u0414\u0430\u043D\u0456 \u0434\u0456\u0430\u0433\u0440\u0430\u043C\u0438 JSON \u0413\u043E\u0434\u0438\u043D\u0438",
              "zh-cn": "JSON \u56FE\u8868\u6570\u636E \u5C0F\u65F6"
            },
            type: "string",
            role: "json",
            read: true,
            write: false,
            desc: {
              en: "Hour History data for eCharts in JSON format",
              de: "St\xFCndliche Verlaufsdaten f\xFCr eCharts im JSON-Format",
              ru: "\u0427\u0430\u0441\u043E\u0432\u044B\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0434\u043B\u044F eCharts \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON",
              pt: "Dados hist\xF3ricos por hora do eCharts em formato JSON",
              nl: "Uur historische gegevens voor eCharts in JSON-formaat.",
              fr: "Donn\xE9es historiques horaires pour eCharts au format JSON",
              it: "Dati storici orari per eCharts in formato JSON",
              es: "Datos hist\xF3ricos por hora de eCharts en formato JSON",
              pl: "Godzinowe dane historyczne dla eCharts w formacie JSON",
              uk: "\u041F\u043E\u0433\u043E\u0434\u0438\u043D\u043D\u0456 \u0456\u0441\u0442\u043E\u0440\u0438\u0447\u043D\u0456 \u0434\u0430\u043D\u0456 \u0434\u043B\u044F eCharts \u0443 \u0444\u043E\u0440\u043C\u0430\u0442\u0456 JSON",
              "zh-cn": "eCharts \u7684\u5386\u53F2\u6570\u636E\uFF08\u6309\u5C0F\u65F6\uFF0CJSON \u683C\u5F0F\uFF09"
            }
          },
          native: {}
        });
      }
      if (this.adapter.config.locationsTotal_minutely_json && this.adapter.config.minutes_15 && this.adapter.config.pv_locations.length > 1) {
        const sumBase = "pv-forecast";
        await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_15-min-json_chart`, {
          type: "state",
          common: {
            name: {
              en: "Sum JSON Chart Data 15 minutes",
              de: "Summe JSON Diagramm Daten 15 Minuten",
              ru: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 JSON \u0437\u0430 15 \u043C\u0438\u043D\u0443\u0442",
              pt: "Sum JSON Dados do Gr\xE1fico 15 minutos",
              nl: "Sum JSON Grafiekgegevens 15 minuten",
              fr: "Sum JSON Donn\xE9es du graphique 15 minutes",
              it: "Sum JSON Grafico Dati 15 minuti",
              es: "Sum JSON Datos de carga 15 minutos",
              pl: "Sum JSON Wykres Dane 15 minut",
              uk: "\u0421\u0443\u043C\u0430 JSON \u0413\u0440\u0430\u0444\u0456\u043A \u0434\u0430\u043D\u0438\u0445 15 \u0445\u0432\u0438\u043B\u0438\u043D",
              "zh-cn": "JSON\u603B\u548C \u56FE\u8868 15\u5206\u949F"
            },
            type: "string",
            role: "json",
            read: true,
            write: false,
            desc: {
              en: "Sum History data for eCharts in JSON format",
              de: "Summe f\xFCr eCharts im JSON-Format",
              ru: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0441\u0443\u043C\u043C \u0434\u043B\u044F \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u044B\u0445 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON",
              pt: "Dados do Sum History para eCharts em JSON",
              nl: "Som geschiedenisgegevens voor eCharts in JSON-formaat",
              fr: "Historique des sommes pour eCharts au format JSON",
              it: "Sum History per eCharts in formato JSON",
              es: "Sumar datos hist\xF3ricos de ECharts en formato JSON",
              pl: "Suma danych historii dla eCharts w formacie JSON",
              uk: "\u0421\u0443\u043C\u0430 \u0434\u0430\u043D\u0438\u0445 \u0456\u0441\u0442\u043E\u0440\u0456\u0457 \u0434\u043B\u044F eCharts \u0443 \u0444\u043E\u0440\u043C\u0430\u0442\u0456 JSON",
              "zh-cn": "\u4EE5 JSON \u683C\u5F0F\u6C47\u603B ECharts \u7684\u5386\u53F2\u6570\u636E"
            }
          },
          native: {}
        });
      }
      if (this.adapter.config.locationsTotal_hourly_json && this.adapter.config.pv_locations.length > 1) {
        const sumBase = "pv-forecast";
        await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_hourly-json_chart`, {
          type: "state",
          common: {
            name: {
              en: "Sum JSON Chart Data Hourly",
              de: "Summe JSON Diagramm Daten St\xFCndlich",
              ru: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 JSON \u0437\u0430 \u0447\u0430\u0441",
              pt: "Sum JSON Dados do Gr\xE1fico Hor\xE1rio",
              nl: "Sum JSON Grafiekgegevens Uurlijk",
              fr: "Sum JSON Donn\xE9es du graphique Horaire",
              it: "Sum JSON Grafico Dati Orari",
              es: "Sum JSON Datos de carga Horaria",
              pl: "Sum JSON Wykres Dane Godzinowe",
              uk: "\u0421\u0443\u043C\u0430 JSON \u0413\u0440\u0430\u0444\u0456\u043A \u0434\u0430\u043D\u0438\u0445 \u0429\u043E\u0433\u043E\u0434\u0438\u043D\u0438",
              "zh-cn": "JSON\u603B\u548C \u56FE\u8868 \u6BCF\u5C0F\u65F6"
            },
            type: "string",
            role: "json",
            read: true,
            write: false,
            desc: {
              en: "Sum History data for eCharts in JSON format",
              de: "Summe f\xFCr eCharts im JSON-Format",
              ru: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0441\u0443\u043C\u043C \u0434\u043B\u044F \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u044B\u0445 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON",
              pt: "Dados do Sum History para eCharts em JSON",
              nl: "Som geschiedenisgegevens voor eCharts in JSON-formaat",
              fr: "Historique des sommes pour eCharts au format JSON",
              it: "Sum History per eCharts in formato JSON",
              es: "Sumar datos hist\xF3ricos de ECharts en formato JSON",
              pl: "Suma danych historii dla eCharts w formacie JSON",
              uk: "\u0421\u0443\u043C\u0430 \u0434\u0430\u043D\u0438\u0445 \u0456\u0441\u0442\u043E\u0440\u0456\u0457 \u0434\u043B\u044F eCharts \u0443 \u0444\u043E\u0440\u043C\u0430\u0442\u0456 JSON",
              "zh-cn": "\u4EE5 JSON \u683C\u5F0F\u6C47\u603B ECharts \u7684\u5386\u53F2\u6570\u636E"
            }
          },
          native: {}
        });
      }
    }
    if (this.adapter.config.minutes_15 && this.adapter.config.locationsTotal_minutely && this.adapter.config.pv_locations.length > 1) {
      const sumBase = "pv-forecast";
      await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_15_Minutely`, {
        type: "channel",
        common: {
          name: {
            en: "Sum Peak from Locations 15 Minutely",
            de: "Summe der Spitzenwerte von Standorten alle 15 Minuten",
            ru: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0439 \u043F\u0438\u043A\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0445\u043E\u0434 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0432 \u0440\u0430\u0437\u043B\u0438\u0447\u043D\u044B\u0445 \u043C\u0435\u0441\u0442\u0430\u0445 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 15 \u043C\u0438\u043D\u0443\u0442.",
            pt: "Soma dos picos a partir de locais a cada 15 minutos",
            nl: "Som van pieken vanaf locaties elke 15 minuten",
            fr: "Somme des pics \xE0 partir des emplacements toutes les 15 minutes",
            it: "Somma dei picchi dalle localit\xE0 ogni 15 minuti",
            es: "Suma de picos desde ubicaciones cada 15 minutos",
            pl: "Sum Peak z lokalizacji 15 minut",
            uk: "\u0421\u0443\u043C\u0430 \u043F\u0456\u043A\u0443 \u0437 \u043C\u0456\u0441\u0446\u044C \u0440\u043E\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u043D\u043D\u044F \u043A\u043E\u0436\u043D\u0456 15 \u0445\u0432\u0438\u043B\u0438\u043D",
            "zh-cn": "\u4ECE\u6307\u5B9A\u5730\u70B9\u51FA\u53D1\uFF0C15\u5206\u949F\u5373\u53EF\u5230\u8FBE\u8428\u59C6\u5CF0"
          }
        },
        native: {}
      });
      for (let i = 0; i < 96; i++) {
        const channelId = `${sumBase}.sum_peak_locations_15_Minutely.${i}`;
        await this.adapter.setObjectNotExistsAsync(channelId, {
          type: "channel",
          common: { name: `Interval ${i}` },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(
          `${sumBase}.sum_peak_locations_15_Minutely.${i}.sum_locations`,
          {
            type: "state",
            common: {
              name: {
                en: "15 Minutes Sum of all locations",
                de: "15 Minuten Summe aller Standorte",
                ru: "15 \u043C\u0438\u043D\u0443\u0442 \u0421\u0443\u043C\u043C\u0430 \u0432\u0441\u0435\u0445 \u043C\u0435\u0441\u0442",
                pt: "15 minutos Soma de todos os locais",
                nl: "15 Minuten Som van alle locaties",
                fr: "15 minutes Somme de tous les lieux",
                it: "15 minuti Somma di tutti i luoghi",
                es: "15 Minutos Suma de todas las localizaciones",
                pl: "15 minut Suma wszystkich lokalizacji",
                uk: "15 \u0445\u0432\u0438\u043B\u0438\u043D \u0421\u0443\u043C\u0430 \u0432\u0441\u0456\u0445 \u043B\u043E\u043A\u0430\u0446\u0456\u0439",
                "zh-cn": "15 Minutes Sum of all locations"
              },
              type: "number",
              role: "value.energy",
              unit: "Wh",
              read: true,
              write: false
            },
            native: {}
          }
        );
        await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_15_Minutely.${i}.time`, {
          type: "state",
          common: {
            name: {
              en: "Time",
              de: "Zeit",
              ru: "\u0412\u0440\u0435\u043C\u044F",
              pt: "Tempo",
              nl: "Tijd",
              fr: "L'heure",
              it: "Tempo",
              es: "Tiempo",
              pl: "Czas",
              uk: "\u0427\u0430\u0441",
              "zh-cn": "Time"
            },
            type: "string",
            role: "date",
            read: true,
            write: false
          },
          native: {}
        });
      }
    }
    if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length > 1) {
      const sumBase = "pv-forecast";
      await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Hourly`, {
        type: "channel",
        common: {
          name: {
            en: "Sum Peak from Locations Hourly",
            de: "Summe der Spitzenwerte von Standorten st\xFCndlich",
            ru: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0439 \u043F\u0438\u043A\u043E\u0432\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0432 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F (\u043F\u043E\u0447\u0430\u0441\u043E\u0432\u0430\u044F \u0448\u043A\u0430\u043B\u0430)",
            pt: "Soma dos picos de localiza\xE7\xE3o por hora",
            nl: "Som van pieken van locaties per uur",
            fr: "Somme maximale des emplacements horaires",
            it: "Somma di picco dalle posizioni orarie",
            es: "Suma de picos desde ubicaciones por hora",
            pl: "Suma szczyt\xF3w z lokalizacji godzinowych",
            uk: "\u0421\u0443\u043C\u0430 \u043F\u0456\u043A\u0443 \u0437 \u043C\u0456\u0441\u0446\u044C \u0440\u043E\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u043D\u043D\u044F \u0449\u043E\u0433\u043E\u0434\u0438\u043D\u0438",
            "zh-cn": "\u4ECE\u5404\u4E2A\u5730\u70B9\u6BCF\u5C0F\u65F6\u8BA1\u7B97\u7684\u603B\u5CF0\u503C"
          }
        },
        native: {}
      });
      for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
        await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Hourly.Hour${hour}`, {
          type: "channel",
          common: {
            name: {
              en: `Hour ${hour}`,
              de: `Stunde ${hour}`,
              ru: `\u0427\u0430\u0441 ${hour}`,
              pt: `Hora ${hour}`,
              nl: `Uur ${hour}`,
              fr: `Heure ${hour}`,
              it: `Ora ${hour}`,
              es: `Hora ${hour}`,
              pl: `Godzina ${hour}`,
              uk: `\u0413\u043E\u0434\u0438\u043D\u0430 ${hour}`,
              "zh-cn": `\u5C0F\u65F6 ${hour}`
            }
          },
          native: {}
        });
        await this.adapter.setObjectNotExistsAsync(
          `${sumBase}.sum_peak_locations_Hourly.Hour${hour}.sum_locations`,
          {
            type: "state",
            common: {
              name: {
                en: "Hourly Sum of all locations",
                de: "St\xFCndliche Summe aller Standorte",
                ru: "\u041F\u043E\u0447\u0430\u0441\u043E\u0432\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u043F\u043E \u0432\u0441\u0435\u043C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C",
                pt: "Soma hor\xE1ria de todos os locais",
                nl: "Uurtotaal van alle locaties",
                fr: "Somme horaire de tous les emplacements",
                it: "Somma oraria di tutte le posizioni",
                es: "Suma horaria de todas las ubicaciones",
                pl: "Suma godzinowa wszystkich lokalizacji",
                uk: "\u041F\u043E\u0433\u043E\u0434\u0438\u043D\u043D\u0430 \u0441\u0443\u043C\u0430 \u0432\u0441\u0456\u0445 \u043B\u043E\u043A\u0430\u0446\u0456\u0439",
                "zh-cn": "\u6240\u6709\u5730\u70B9\u6BCF\u5C0F\u65F6\u603B\u548C"
              },
              type: "number",
              role: "value.energy",
              unit: "Wh",
              read: true,
              write: false
            },
            native: {}
          }
        );
        await this.adapter.setObjectNotExistsAsync(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.time`, {
          type: "state",
          common: {
            name: {
              en: "Hour Time",
              de: "Stundenzeit",
              ru: "\u0427\u0430\u0441 \u0412\u0440\u0435\u043C\u044F",
              pt: "Hora",
              nl: "Uur Tijd",
              fr: "Heure",
              it: "Ora Ora",
              es: "Hora Tiempo",
              pl: "Godzina Czas",
              uk: "\u0413\u043E\u0434\u0438\u043D\u0430 \u0427\u0430\u0441",
              "zh-cn": "\u5C0F\u65F6"
            },
            type: "string",
            role: "date",
            read: true,
            write: false
          },
          native: {}
        });
      }
    }
  }
  async updateAllLocations() {
    for (const location of this.adapter.config.pv_locations) {
      try {
        const locationName = this.sanitizeLocationName(location.name);
        const base = `pv-forecast.${locationName}`;
        await this.updateLocation(location, base);
      } catch (error) {
        this.adapter.log.error(`Error updating PV location ${location.name}: ${error.message}`);
      }
    }
    await this.updateSumLocations();
    const now = /* @__PURE__ */ new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
    await this.adapter.setState("info.lastUpdate_PV_Forecast", { val: timestamp, ack: true });
  }
  async updateSumLocations() {
    if (this.adapter.config.locationsTotal && this.adapter.config.pv_locations.length >= 1) {
      for (let day = 0; day < this.adapter.config.forecastDays; day++) {
        let sum = 0;
        for (const location of this.adapter.config.pv_locations) {
          const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
          const state = await this.adapter.getStateAsync(`${base}.daily-forecast.day${day}.Peak_day`);
          if (state && state.val !== null && state.val !== void 0) {
            sum += state.val;
          }
        }
        await this.adapter.setState(`pv-forecast.sum_peak_locations_Daily.day${day}.sum_locations`, {
          val: sum,
          ack: true
        });
      }
    }
    if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length >= 1) {
      for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
        let sum = 0;
        for (const location of this.adapter.config.pv_locations) {
          const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
          const state = await this.adapter.getStateAsync(
            `${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`
          );
          if (state && state.val !== null && state.val !== void 0) {
            sum += state.val;
          }
        }
        await this.adapter.setState(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.sum_locations`, {
          val: sum,
          ack: true
        });
      }
    }
    if (this.adapter.config.minutes_15 && this.adapter.config.locationsTotal_minutely && this.adapter.config.pv_locations.length > 1) {
      this.adapter.log.debug("Starting 15-min sum calculation...");
      for (let i = 0; i < 96; i++) {
        let totalSum = 0;
        let timeVal = "";
        let foundAnyValue = false;
        for (const location of this.adapter.config.pv_locations) {
          const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
          const stateId = `${base}.15-min-forecast.${i}.global_tilted_irradiance`;
          const timeId = `${base}.15-min-forecast.${i}.time`;
          const locState = await this.adapter.getStateAsync(stateId);
          const locTime = await this.adapter.getStateAsync(timeId);
          if (locState && locState.val !== null && locState.val !== void 0) {
            totalSum += Number(locState.val);
            foundAnyValue = true;
          }
          if (locTime && locTime.val) {
            timeVal = String(locTime.val);
          }
        }
        if (foundAnyValue) {
          await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.sum_locations`, {
            val: totalSum,
            ack: true
          });
        }
        if (timeVal) {
          await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.time`, {
            val: timeVal,
            ack: true
          });
        }
      }
    }
  }
  async updateLocation(location, base) {
    var _a, _b;
    const effectiveLocation = { ...location };
    const latMissing = effectiveLocation.pv_latitude === void 0 || effectiveLocation.pv_latitude === null || effectiveLocation.pv_latitude === "";
    const lonMissing = effectiveLocation.pv_longitude === void 0 || effectiveLocation.pv_longitude === null || effectiveLocation.longitude === "";
    if (latMissing || lonMissing) {
      this.adapter.log.debug(
        `[${location.name}] Debug:longitude and/or latitude not set, loading system configuration`
      );
      const sysConfig = await this.adapter.getForeignObjectAsync("system.config");
      const sysLat = (_a = sysConfig == null ? void 0 : sysConfig.common) == null ? void 0 : _a.latitude;
      const sysLon = (_b = sysConfig == null ? void 0 : sysConfig.common) == null ? void 0 : _b.longitude;
      if (sysLat !== void 0 && sysLat !== null && sysLon !== void 0 && sysLon !== null) {
        effectiveLocation.pv_latitude = sysLat;
        effectiveLocation.pv_longitude = sysLon;
        this.adapter.log.info(
          `[${location.name}] using system latitude: ${effectiveLocation.pv_latitude}, system longitude: ${effectiveLocation.pv_longitude}`
        );
      } else {
        this.adapter.log.error(
          `[${location.name}] latitude and/or longitude not set and no system coordinates available. Skipping location.`
        );
        return;
      }
    }
    try {
      const data = await this.apiCaller.fetchForecastData(effectiveLocation, this.adapter.config.forecastDays);
      if (!data || !data.hourly || !data.hourly.time) {
        this.adapter.log.error(`[${location.name}] The API returned no data..`);
        return;
      }
      let kwpRaw = location.kwp;
      if (typeof kwpRaw === "string") {
        kwpRaw = kwpRaw.replace(",", ".");
      }
      const kwpFactor = parseFloat(kwpRaw) || 0;
      const dailySums = {};
      for (let i = 0; i < data.hourly.time.length; i++) {
        const timeStr = data.hourly.time[i];
        const rawIrradiance = data.hourly.global_tilted_irradiance[i];
        if (timeStr && rawIrradiance !== void 0) {
          const dateKey = timeStr.split("T")[0];
          if (!dailySums[dateKey]) {
            dailySums[dateKey] = 0;
          }
          dailySums[dateKey] += rawIrradiance * kwpFactor;
        }
      }
      const todayObj = /* @__PURE__ */ new Date();
      todayObj.setHours(12, 0, 0, 0);
      const sysLang = this.adapter.language || "de";
      for (let day = 0; day < this.adapter.config.forecastDays; day++) {
        const targetDate = new Date(todayObj);
        targetDate.setDate(todayObj.getDate() + day);
        const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
        const totalWh = Math.round(dailySums[dateKey] || 0);
        const formattedDisplayDate = targetDate.toLocaleDateString(sysLang, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
        await this.adapter.setState(`${base}.daily-forecast.day${day}.Date`, {
          val: formattedDisplayDate,
          ack: true
        });
        await this.adapter.setState(`${base}.daily-forecast.day${day}.Peak_day`, {
          val: totalWh,
          ack: true
        });
      }
      const now = /* @__PURE__ */ new Date();
      let startSearchTime;
      if (this.adapter.config.hourlyUpdate === 1) {
        startSearchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      } else {
        startSearchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
      }
      let currentHourIndex = data.hourly.time.findIndex((t) => new Date(t).getTime() >= startSearchTime);
      if (currentHourIndex === -1) {
        currentHourIndex = 0;
      }
      for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
        const idx = currentHourIndex + hour;
        if (idx < data.hourly.time.length) {
          const apiDate = new Date(data.hourly.time[idx]);
          const formattedTime = apiDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
          const unixTimestamp = apiDate.getTime();
          const powerW = Math.round(data.hourly.global_tilted_irradiance[idx] * kwpFactor);
          const sunshineMinutes = Math.round((data.hourly.sunshine_duration[idx] || 0) / 60);
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.time`, {
            val: formattedTime,
            ack: true
          });
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.unix_time_stamp`, {
            val: unixTimestamp,
            ack: true
          });
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`, {
            val: powerW,
            ack: true
          });
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.temperature_2m`, {
            val: data.hourly.temperature_2m[idx],
            ack: true
          });
          if (this.adapter.config.cloud_cover) {
            await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.cloud_cover`, {
              val: data.hourly.cloud_cover[idx],
              ack: true
            });
          }
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.wind_speed_10m`, {
            val: data.hourly.wind_speed_10m[idx],
            ack: true
          });
          if (this.adapter.config.sunhine_duration) {
            await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.sunshine_duration`, {
              val: sunshineMinutes,
              ack: true
            });
          }
          const ambientTemp = data.hourly.temperature_2m[idx];
          const irradiance = data.hourly.global_tilted_irradiance[idx];
          const windSpeedKmH = data.hourly.wind_speed_10m[idx] || 0;
          const windSpeedMS = windSpeedKmH / 3.6;
          const pvTemp = Math.round((ambientTemp + irradiance / (25 + 6.84 * windSpeedMS)) * 10) / 10;
          await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.pv_temperature`, {
            val: pvTemp,
            ack: true
          });
          if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length > 1) {
            await this.adapter.setState(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.time`, {
              val: formattedTime,
              ack: true
            });
          }
        }
      }
      if (this.adapter.config.minutes_15 && data.minutely_15) {
        this.adapter.log.debug(`[${location.name}] Fill in the 15-minute forecast...`);
        const minData = data.minutely_15;
        let unixTimestamp = 0;
        for (let i = 0; i < 96; i++) {
          if (minData.time[i]) {
            const apiDate = new Date(minData.time[i]);
            unixTimestamp = apiDate.getTime();
            const formattedTime = apiDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit"
            });
            const path = `${base}.15-min-forecast.${i}`;
            await this.adapter.setState(`${path}.time`, { val: formattedTime, ack: true });
            await this.adapter.setState(`${path}.unix_time_stamp`, { val: unixTimestamp, ack: true });
            if (this.adapter.config.locationsTotal_minutely && this.adapter.config.pv_locations.length > 1) {
              await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.time`, {
                val: formattedTime,
                ack: true
              });
            }
            if (minData.global_tilted_irradiance) {
              await this.adapter.setState(`${path}.global_tilted_irradiance`, {
                val: Math.round(minData.global_tilted_irradiance[i] * kwpFactor),
                ack: true
              });
            }
            if (minData.temperature_2m) {
              await this.adapter.setState(`${path}.temperature_2m`, {
                val: minData.temperature_2m[i],
                ack: true
              });
            }
            if (minData.wind_speed_10m) {
              await this.adapter.setState(`${path}.wind_speed_10m`, {
                val: minData.wind_speed_10m[i],
                ack: true
              });
            }
            if (this.adapter.config.sunshine_duration) {
              if (minData.sunshine_duration) {
                const sunMin = Math.round((minData.sunshine_duration[i] || 0) / 60);
                await this.adapter.setState(`${path}.sunshine_duration`, {
                  val: sunMin,
                  ack: true
                });
              }
            }
            if (minData.temperature_2m !== void 0 && minData.global_tilted_irradiance !== void 0) {
              const ambientTemp = minData.temperature_2m[i];
              const irradiance = minData.global_tilted_irradiance[i];
              const windSpeedKmH = minData.wind_speed_10m ? minData.wind_speed_10m[i] : 0;
              const windSpeedMS = windSpeedKmH / 3.6;
              const pvTemp = Math.round((ambientTemp + irradiance / (25 + 6.84 * windSpeedMS)) * 10) / 10;
              await this.adapter.setState(`${path}.pv_temperature`, {
                val: pvTemp,
                ack: true
              });
            }
          }
        }
      }
      if (this.adapter.config.minutes_15_json && data.minutely_15) {
        this.adapter.log.debug(`[${location.name}] Generating 15-minute JSON chart...`);
        const minData = data.minutely_15;
        const chartData = [];
        for (let i = 0; i < 96; i++) {
          if (minData.time[i]) {
            const apiDate = new Date(minData.time[i]);
            const unixTimestamp = apiDate.getTime();
            const irradianceValue = minData.global_tilted_irradiance ? Math.round(minData.global_tilted_irradiance[i] * kwpFactor) : 0;
            chartData.push({
              ts: unixTimestamp,
              val: irradianceValue
            });
          }
        }
        await this.adapter.setState(`${base}.15-min-json_chart`, {
          val: JSON.stringify(chartData),
          ack: true
        });
      }
      if (this.adapter.config.hours_json && data.hourly) {
        this.adapter.log.debug(`[${location.name}] Generating hourly JSON chart...`);
        const hourlyData = data.hourly;
        const chartData = [];
        const forecastHours = this.adapter.config.pv_forecastHours || 24;
        for (let i = 0; i < forecastHours; i++) {
          if (hourlyData.time[i]) {
            const apiDate = new Date(hourlyData.time[i]);
            const unixTimestamp = apiDate.getTime();
            const irradianceValue = hourlyData.global_tilted_irradiance ? Math.round(hourlyData.global_tilted_irradiance[i] * kwpFactor) : 0;
            chartData.push({
              ts: unixTimestamp,
              val: irradianceValue
            });
          }
        }
        await this.adapter.setState(`${base}.hourly-json_chart`, {
          val: JSON.stringify(chartData),
          ack: true
        });
      }
      if (this.adapter.config.locationsTotal_minutely_json && this.adapter.config.minutes_15 && this.adapter.config.pv_locations.length > 1) {
        const sumChartData = [];
        for (let i = 0; i < 96; i++) {
          let totalSum = 0;
          let currentTimeStr = "";
          for (const location2 of this.adapter.config.pv_locations) {
            const base2 = `pv-forecast.${this.sanitizeLocationName(location2.name)}`;
            const locTimeState = await this.adapter.getStateAsync(
              `${base2}.15-min-forecast.${i}.unix_time_stamp`
            );
            const locValState = await this.adapter.getStateAsync(
              `${base2}.15-min-forecast.${i}.global_tilted_irradiance`
            );
            if (locValState && locValState.val !== null) {
              totalSum += locValState.val;
            }
            if (locTimeState && locTimeState.val) {
              currentTimeStr = String(locTimeState.val);
            }
          }
          if (currentTimeStr) {
            sumChartData.push({
              ts: currentTimeStr,
              val: totalSum
            });
          }
        }
        if (sumChartData.length > 0) {
          await this.adapter.setState(`pv-forecast.sum_peak_15-min-json_chart`, {
            val: JSON.stringify(sumChartData),
            ack: true
          });
          this.adapter.log.debug(`15-min Sum-JSON created.`);
        }
      }
      if (this.adapter.config.locationsTotal_minutely_json && this.adapter.config.minutes_15 && this.adapter.config.pv_locations.length > 1) {
        const sumChartData = [];
        const forecastHours = this.adapter.config.pv_forecastHours || 24;
        for (let i = 0; i < forecastHours; i++) {
          let totalSum = 0;
          let currentTimeStr = "";
          for (const location2 of this.adapter.config.pv_locations) {
            const base2 = `pv-forecast.${this.sanitizeLocationName(location2.name)}`;
            const locTimeState = await this.adapter.getStateAsync(
              `${base2}.hourly-forecast.hour${i}.unix_time_stamp`
            );
            const locValState = await this.adapter.getStateAsync(
              `${base2}.hourly-forecast.hour${i}.global_tilted_irradiance`
            );
            if (locValState && locValState.val !== null) {
              totalSum += locValState.val;
            }
            if (locTimeState && locTimeState.val) {
              currentTimeStr = String(locTimeState.val);
            }
          }
          if (currentTimeStr) {
            sumChartData.push({
              ts: currentTimeStr,
              val: totalSum
            });
          }
        }
        if (sumChartData.length > 0) {
          await this.adapter.setState(`pv-forecast.sum_peak_hourly-json_chart`, {
            val: JSON.stringify(sumChartData),
            ack: true
          });
          this.adapter.log.debug(`Hourly Sum-JSON created.`);
        }
      }
      this.adapter.log.info(
        `[${location.name}] Update successful. Day0: ${Math.round(dailySums[Object.keys(dailySums)[0]] || 0)} Wh`
      );
    } catch (error) {
      this.adapter.log.error(`[${location.name}] Error: ${error.message}`);
    }
  }
  sanitizeLocationName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  }
  /**
   * Clears the active update interval.
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.adapter.log.debug("PV-Service interval cleared.");
    }
    if (this.astroTimeout) {
      clearTimeout(this.astroTimeout);
      this.astroTimeout = null;
      this.adapter.log.debug("PV-Service astro timer cleared.");
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PVService
});
//# sourceMappingURL=pv-service.js.map
