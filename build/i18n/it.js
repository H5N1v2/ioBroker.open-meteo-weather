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
var it_exports = {};
__export(it_exports, {
  it: () => it
});
module.exports = __toCommonJS(it_exports);
const it = {
  // Aktuelle Werte (Current)
  temperature_2m: "Temperatura (2m)",
  relative_humidity_2m: "Umidit\xE0 relativa (2m)",
  apparent_temperature: "Temperatura percepita",
  precipitation: "Precipitazioni",
  weather_code: "Codice meteo",
  cloud_cover: "Copertura nuvolosa",
  wind_speed_10m: "Velocit\xE0 del vento (10m)",
  wind_direction_10m: "Direzione del vento (10m)",
  wind_gusts_10m: "Raffiche di vento (10m)",
  is_day: "Giorno/Notte",
  dew_point_2m: "Punto di rugiada (2m)",
  wind_direction_text: "Direzione del vento testo",
  weather_text: "Testo del tempo",
  icon_url: "URL dell'icona",
  time: "Ora",
  date: "Data",
  pressure_msl: "Presione della superficie",
  pressure_msl_mean: "Presione media della superficie",
  wind_gust_icon: "Icona di raffiche di vento",
  wind_direction_icon: "Icona della direzione del vento",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "Temperatura max",
  temperature_2m_min: "Temperatura min",
  sunrise: "Alba",
  sunset: "Tramonto",
  sunshine_duration: "Durata del sole",
  uv_index_max: "Indice UV max",
  rain_sum: "Somma pioggia",
  rain: "Pioggia",
  soil_temperature_0cm: "Temperatura del suolo (0cm)",
  snowfall: "Neve",
  snow_depth: "Profondit\xE0 neve",
  snowfall_sum: "Somma neve",
  precipitation_probability_max: "Probabilit\xE0 precipitazioni max",
  precipitation_probability: "Probabilit\xE0 di precipitazioni",
  precipitation_sum: "Precipitazioni totali",
  wind_speed_10m_max: "Velocit\xE0 del vento max",
  wind_direction_10m_dominant: "Direzione del vento dominante",
  wind_gusts_10m_max: "Raffiche di vento max",
  dew_point_2m_mean: "Punto di rugiada medio (2m)",
  relative_humidity_2m_mean: "Umidit\xE0 relativa media (2m)",
  moonset: "Tramonto della luna",
  moonrise: "Sorgere della luna",
  moon_phase_val: "Fase lunare",
  moon_phase_text: "Descrizione fase lunare",
  moon_phase_icon: "Icona fase lunare",
  name_day: "Nome del giorno",
  // Luftqualität (Air Quality)
  european_aqi: "Indice europeo di qualit\xE0 dell'aria",
  pm10: "Particolato PM10",
  pm2_5: "Particolato PM2.5",
  carbon_monoxide: "Monossido di carbonio",
  dust: "Polvere",
  alder_pollen: "Polline di ontano",
  birch_pollen: "Polline di betulla",
  grass_pollen: "Polline di graminacee",
  mugwort_pollen: "Polline di artemisia",
  ragweed_pollen: "Polline di ambrosia",
  olive_pollen: "Polline di olivo",
  olive_pollen_text: "Carico di polline di olivo",
  ozone: "Ozono",
  ragweed_pollen_text: "Carico di polline di ambrosia",
  mugwort_pollen_text: "Carico di polline di artemisia",
  grass_pollen_text: "Carico di polline di graminacee",
  birch_pollen_text: "Carico di polline di betulla",
  alder_pollen_text: "Carico di polline di ontano"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  it
});
//# sourceMappingURL=it.js.map
