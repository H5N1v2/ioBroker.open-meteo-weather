"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var role_mapping_exports = {};
__export(role_mapping_exports, {
  getRole: () => getRole
});
module.exports = __toCommonJS(role_mapping_exports);
const baseRoles = {
  // Luftqualität & Pollenflug
  pm10: "value",
  pm2_5: "value",
  nitrogen_dioxide: "value",
  alder_pollen: "value",
  birch_pollen: "value",
  grass_pollen: "value",
  mugwort_pollen: "value",
  ragweed_pollen: "value",
  carbon_monoxide: "value",
  dust: "value",
  olive_pollen: "value",
  ozone: "value",
  european_aqi: "value",
  // Temperaturen
  temperature_2m: "value.temperature",
  temperature_2m_max: "value.temperature.max",
  temperature_2m_min: "value.temperature.min",
  apparent_temperature: "value.temperature.feelslike",
  dew_point_2m: "value.temperature.dewpoint",
  dew_point_2m_mean: "value",
  soil_temperature_0cm: "value",
  // Feuchtigkeit & Druck
  relative_humidity_2m: "value.humidity",
  relative_humidity_2m_mean: "value.humidity",
  pressure_msl: "value.pressure",
  pressure_msl_mean: "value.pressure",
  // Niederschlag
  precipitation: "value.precipitation",
  precipitation_sum: "value.precipitation.day",
  precipitation_probability: "value.precipitation.chance",
  precipitation_probability_max: "value.precipitation.chance",
  rain: "value.rain",
  rain_sum: "value.rain",
  snowfall: "value.snow",
  snowfall_sum: "value.snow",
  snowfall_height: "value.snowline",
  et0_fao_evapotranspiration: "value",
  // Wind
  wind_speed_10m: "value.speed.wind",
  wind_speed_10m_max: "value.speed.max.wind",
  wind_direction_10m: "value.direction.wind",
  wind_direction_10m_dominant: "value.direction.wind",
  wind_gusts_10m: "value.speed.wind.gust",
  wind_gusts_10m_max: "value.speed.wind.gust",
  // Sonne, Wolken & Wetter
  cloud_cover: "value.clouds",
  cloud_cover_max: "value.clouds",
  uv_index: "value.uv",
  uv_index_max: "value.uv",
  sunshine_duration: "value.radiation",
  sunrise: "date.sunrise",
  sunset: "date.sunset",
  weather_code: "weather.state",
  // Schnee/Frost
  snow_depth: "value",
  freezing_level_height: "value"
};
function getRole(context, key, index) {
  const base = baseRoles[key] || "value";
  if (key === "dew_point_2m" || key === "rain" || key === "snowfall" || key === "precipitation_probability") {
    if (context === "hourly" && index !== void 0 && index > 0) {
      return "value";
    }
  }
  const noForecastSuffix = [
    "cloud_cover_max",
    "uv_index_max",
    "precipitation_probability_max",
    "rain_sum",
    "relative_humidity_2m_mean",
    "snowfall_sum",
    "sunshine_duration"
  ];
  const downgradeToValue = ["snowfall_sum", "precipitation_probability_max", "rain_sum"];
  if (context === "daily" && index !== void 0) {
    if (index > 0 && downgradeToValue.includes(key)) {
      return "value";
    }
    if (noForecastSuffix.includes(key)) {
      return base;
    }
    if (base.startsWith("value.") || base.startsWith("weather.")) {
      return `${base}.forecast.${index}`;
    }
  }
  if (key === "sunrise" || key === "sunset") {
    if (context === "daily") {
      if (index === 0) {
        return `date.${key}`;
      }
      return "value";
    }
  }
  if (context === "hourly") {
    if (key === "precipitation" || key === "rain" || key === "snowfall") {
      return `${base}.hour`;
    }
  }
  return base;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getRole
});
//# sourceMappingURL=role_mapping.js.map
