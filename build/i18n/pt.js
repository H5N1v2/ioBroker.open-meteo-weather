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
var pt_exports = {};
__export(pt_exports, {
  pt: () => pt
});
module.exports = __toCommonJS(pt_exports);
const pt = {
  // Aktuelle Werte (Current)
  temperature_2m: "Temperatura (2m)",
  relative_humidity_2m: "Humidade relativa (2m)",
  apparent_temperature: "Temperatura aparente",
  precipitation: "Precipita\xE7\xE3o",
  weather_code: "C\xF3digo meteorol\xF3gico",
  cloud_cover: "Cobertura de nuvens",
  wind_speed_10m: "Velocidade do vento (10m)",
  wind_direction_10m: "Dire\xE7\xE3o do vento (10m)",
  wind_gusts_10m: "Rajadas de vento (10m)",
  is_day: "Dia/Noite",
  dew_point_2m: "Ponto de orvalho (2m)",
  wind_direction_text: "Dire\xE7\xE3o do vento texto",
  weather_text: "Texto do tempo",
  icon_url: "URL do \xEDcone",
  time: "Hora",
  pressure_msl: "Pres\xE3o da superficie",
  pressure_msl_mean: "Pres\xE3o media da superficie",
  wind_gust_icon: "Icono de rajadas de vento",
  wind_direction_icon: "Icono da dire\xE7\xE3o do vento",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "Temperatura m\xE1x.",
  temperature_2m_min: "Temperatura m\xEDn.",
  sunrise: "Nascer do sol",
  sunset: "P\xF4r do sol",
  sunshine_duration: "Dura\xE7\xE3o do sol",
  uv_index_max: "\xCDndice UV m\xE1x.",
  rain_sum: "Soma de chuva",
  rain: "Chuva",
  soil_temperature_0cm: "Temperatura do solo (0cm)",
  snowfall: "Nevada",
  snow_depth: "Profundidade da neve",
  snowfall_sum: "Soma de neve",
  precipitation_probability_max: "Probabilidade de precipita\xE7\xE3o m\xE1x.",
  wind_speed_10m_max: "Velocidade do vento m\xE1x.",
  wind_direction_10m_dominant: "Dire\xE7\xE3o do vento dominante",
  wind_gusts_10m_max: "Rajadas de vento m\xE1x.",
  dew_point_2m_mean: "Ponto de orvalho m\xE9dio (2m)",
  moonset: "Ocaso da lua",
  moonrise: "Nascer da lua",
  moon_phase_val: "Fase lunar",
  moon_phase_text: "Texto da fase lunar",
  moon_phase_icon: "Icono da fase lunar",
  // Luftqualität (Air Quality)
  european_aqi: "\xCDndice Europeu de Qualidade do Ar",
  pm10: "Part\xEDculas em suspens\xE3o PM10",
  pm2_5: "Part\xEDculas em suspens\xE3o PM2.5",
  alder_pollen: "P\xF3len de Alno",
  birch_pollen: "P\xF3len de B\xE9tula",
  grass_pollen: "P\xF3len de Gram\xEDneas",
  mugwort_pollen: "P\xF3len de Artem\xEDsia",
  ragweed_pollen: "P\xF3len de Ambr\xF3sia",
  ragweed_pollen_text: "Carga de p\xF3len de ambr\xF3sia",
  mugwort_pollen_text: "Carga de p\xF3len de artem\xEDsia",
  grass_pollen_text: "Carga de p\xF3len de gram\xEDneas",
  birch_pollen_text: "Carga de p\xF3len de b\xE9tula",
  alder_pollen_text: "Carga de p\xF3len de aliso"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  pt
});
//# sourceMappingURL=pt.js.map
