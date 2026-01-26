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
var es_exports = {};
__export(es_exports, {
  es: () => es
});
module.exports = __toCommonJS(es_exports);
const es = {
  // Aktuelle Werte (Current)
  temperature_2m: "Temperatura (2m)",
  relative_humidity_2m: "Humedad relativa (2m)",
  apparent_temperature: "Sensaci\xF3n t\xE9rmica",
  precipitation: "Precipitaci\xF3n",
  weather_code: "C\xF3digo del tiempo",
  cloud_cover: "Nubosidad",
  wind_speed_10m: "Velocidad del viento (10m)",
  wind_direction_10m: "Direcci\xF3n del viento (10m)",
  wind_gusts_10m: "R\xE1fagas de viento (10m)",
  is_day: "D\xEDa/Noche",
  dew_point_2m: "Punto de roc\xEDo (2m)",
  wind_direction_text: "Direcci\xF3n del viento texto",
  weather_text: "Texto del tiempo",
  icon_url: "URL del icono",
  time: "Hora",
  pressure_msl: "Presi\xF3n de la superficie",
  pressure_msl_mean: "Presi\xF3n media de la superficie",
  wind_gust_icon: "Icono de r\xE1fagas de viento",
  wind_direction_icon: "Icono de la direcci\xF3n del viento",
  moonset: "Puesta de la luna",
  moonrise: "Salida de la luna",
  moon_phase_val: "Fase lunar",
  moon_phase_text: "Texto de la fase lunar",
  moon_phase_icon: "Icono de la fase lunar",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "Temperatura m\xE1x.",
  temperature_2m_min: "Temperatura m\xEDn.",
  sunrise: "Amanecer",
  sunset: "Atardecer",
  sunshine_duration: "Duraci\xF3n del sol",
  uv_index_max: "\xCDndice UV m\xE1x.",
  rain_sum: "Suma de lluvia",
  rain: "Lluvia",
  soil_temperature_0cm: "Temperatura del suelo (0cm)",
  snowfall: "Nieve",
  snow_depth: "Profundidad de nieve",
  snowfall_sum: "Suma de nieve",
  precipitation_probability_max: "Probabilidad de precipitaci\xF3n m\xE1x.",
  wind_speed_10m_max: "Velocidad del viento m\xE1x.",
  wind_direction_10m_dominant: "Direcci\xF3n del viento dominante",
  wind_gusts_10m_max: "R\xE1fagas de viento m\xE1x.",
  dew_point_2m_mean: "Punto de roc\xEDo medio (2m)",
  relative_humidity_2m_mean: "Humedad relativa media (2m)",
  name_day: "Nombre del d\xEDa",
  // Luftqualität (Air Quality)
  european_aqi: "\xCDndice Europeo de Calidad del Aire",
  pm10: "Part\xEDculas en suspensi\xF3n PM10",
  pm2_5: "Part\xEDculas en suspensi\xF3n PM2.5",
  carbon_monoxide: "Mon\xF3xido de carbono",
  dust: "Polvo",
  alder_pollen: "Polen de Aliso",
  birch_pollen: "Polen de Abedul",
  grass_pollen: "Polen de Gram\xEDneas",
  mugwort_pollen: "Polen de Artemisa",
  ragweed_pollen: "Polen de Ambros\xEDa",
  olive_pollen: "Polen de olivo",
  olive_pollen_text: "Niveles de polen de olivo",
  ozone: "Ozono",
  ragweed_pollen_text: "Carga de polen de ambros\xEDa",
  mugwort_pollen_text: "Carga de polen de artemisa",
  grass_pollen_text: "Carga de polen de gram\xEDneas",
  birch_pollen_text: "Carga de polen de abedul",
  alder_pollen_text: "Carga de polen de aliso"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  es
});
//# sourceMappingURL=es.js.map
