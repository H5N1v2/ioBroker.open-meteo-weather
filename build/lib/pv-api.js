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
var pv_api_exports = {};
__export(pv_api_exports, {
  ApiCaller: () => ApiCaller
});
module.exports = __toCommonJS(pv_api_exports);
var import_axios = __toESM(require("axios"));
class ApiCaller {
  axiosInstance;
  log;
  /**
   * Initialize the API caller with axios configuration
   *
   * @param adapter - Adapter instance providing logger access
   */
  constructor(adapter) {
    this.log = adapter.log;
    this.axiosInstance = import_axios.default.create({
      timeout: 15e3
    });
  }
  /**
   * Fetch PV forecast data from Open-Meteo API
   *
   * @param location - Location configuration
   * @param forecastDays_pv - Number of days to forecast
   * @returns Promise with forecast data
   */
  async fetchForecastData(location, forecastDays_pv) {
    var _a, _b;
    const hourlyparam_keys = "global_tilted_irradiance,cloud_cover,temperature_2m,wind_speed_10m,sunshine_duration";
    const minutlyparam_keys = "global_tilted_irradiance,cloud_cover,temperature_2m,wind_speed_10m,sunshine_duration";
    const url = `https://api.open-meteo.com/v1/forecast`;
    try {
      const response = await this.axiosInstance.get(url, {
        params: {
          latitude: location.pv_latitude,
          longitude: location.pv_longitude,
          tilt: location.tilt,
          azimuth: location.azimuth,
          hourly: hourlyparam_keys,
          timezone: location.pv_timezone || "auto",
          forecast_days: forecastDays_pv,
          minutely_15: minutlyparam_keys
        }
      });
      const fullUrl = import_axios.default.getUri(response.config);
      this.log.debug(`[${location.name}] DEBUG: API URL: ${fullUrl}`);
      return response.data;
    } catch (error) {
      if (import_axios.default.isAxiosError(error)) {
        const reason = (_b = (_a = error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.reason;
        const reasonSuffix = reason ? ` \u2013 Open-Meteo reason: "${reason}"` : "";
        if (error.response) {
          const status = error.response.status;
          if (status === 429) {
            this.log.warn(
              `[${location.name}] Rate limit reached (429 Too Many Requests). Please increase the query interval.${reasonSuffix}`
            );
          } else if (status === 400) {
            this.log.error(
              `[${location.name}] Invalid parameters (400 Bad Request) \u2013 please check coordinates and configuration.${reasonSuffix}`
            );
          } else if (status >= 500) {
            this.log.error(
              `[${location.name}] Open-Meteo Server error (${status}) \u2013 the service may be temporarily unavailable.${reasonSuffix}`
            );
          } else {
            this.log.error(
              `[${location.name}] API error (HTTP ${status}): ${error.message}${reasonSuffix}`
            );
          }
        } else if (error.request) {
          this.log.error(
            `[${location.name}] No response received from server \u2013 please check network connection or DNS. (${error.message})`
          );
        } else {
          this.log.error(`[${location.name}] Error setting up API request: ${error.message}`);
        }
        throw new Error(`PV API request failed: ${error.message}${reasonSuffix}`);
      }
      throw error;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ApiCaller
});
//# sourceMappingURL=pv-api.js.map
