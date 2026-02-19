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
var api_caller_exports = {};
__export(api_caller_exports, {
  fetchAllWeatherData: () => fetchAllWeatherData
});
module.exports = __toCommonJS(api_caller_exports);
var import_axios = __toESM(require("axios"));
async function fetchAllWeatherData(config, logger) {
  const tz = encodeURIComponent(config.timezone);
  const results = {};
  const axiosConfig = {
    timeout: 15e3,
    headers: {
      Connection: "close"
    }
  };
  const unitParams = config.isImperial ? "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" : "";
  let fHoursParam = "";
  let fHoursParam_keys = "";
  if (config.forecastHoursEnabled) {
    const totalHours = config.forecastHours;
    fHoursParam = `&forecast_hours=${totalHours}`;
    fHoursParam_keys = `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,et0_fao_evapotranspiration,rain,weather_code,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,soil_temperature_0cm,uv_index,sunshine_duration,is_day,snowfall,snow_depth,global_tilted_irradiance`;
  }
  const currentparam_keys = "temperature_2m,relative_humidity_2m,pressure_msl,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";
  const dailyparam_keys = "relative_humidity_2m_mean,weather_code,temperature_2m_max,temperature_2m_min,pressure_msl_mean,sunrise,sunshine_duration,sunset,uv_index_max,precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,et0_fao_evapotranspiration_sum,cloud_cover_max,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,dew_point_2m_mean";
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current=${currentparam_keys}&daily=${dailyparam_keys}${fHoursParam_keys}&timezone=${tz}&forecast_days=${config.forecastDays}${fHoursParam}${unitParams}`;
  if (logger) {
    logger.debug(`Open-Meteo Weather URL from ${config.location}: ${weatherUrl}`);
  }
  try {
    const resW = await import_axios.default.get(weatherUrl, axiosConfig);
    if (logger) {
      logger.debug(`Open-Meteo Weather Response Status: ${resW.status}`);
    }
    results.weather = resW.data;
    if (resW.data.hourly) {
      results.hourly = resW.data;
    }
  } catch (error) {
    if (logger) {
      logger.error(`Error retrieving weather data: ${error.message}`);
    }
    throw new Error(`Weather API request failed: ${error.message}`);
  }
  const pollenparam_keys = "pm10,pm2_5,nitrogen_dioxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen,carbon_monoxide,dust,olive_pollen,ozone";
  const pollenparam_keys_hourly = `&hourly=${pollenparam_keys}`;
  if (config.airQualityEnabled) {
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${config.latitude}&longitude=${config.longitude}&current=european_aqi,${pollenparam_keys}${pollenparam_keys_hourly}&timezone=${tz}&forecast_days=${config.forecastDays > 7 ? 7 : config.forecastDays}`;
    if (logger) {
      logger.debug(`Open-Meteo Air Quality URL: ${airUrl}`);
    }
    try {
      const resA = await import_axios.default.get(airUrl, axiosConfig);
      if (logger) {
        logger.debug(`Open-Meteo Air Quality Response Status: ${resA.status}`);
      }
      results.air = resA.data;
    } catch (error) {
      if (logger) {
        logger.warn(`Error retrieving air quality data: ${error.message}`);
      }
    }
  }
  return results;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fetchAllWeatherData
});
//# sourceMappingURL=api_caller.js.map
