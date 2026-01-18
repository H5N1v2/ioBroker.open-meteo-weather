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
var pl_exports = {};
__export(pl_exports, {
  pl: () => pl
});
module.exports = __toCommonJS(pl_exports);
const pl = {
  // Aktuelle Werte (Current)
  temperature_2m: "Temperatura (2m)",
  relative_humidity_2m: "Wilgotno\u015B\u0107 wzgl\u0119dna (2m)",
  apparent_temperature: "Temperatura odczuwalna",
  precipitation: "Opad",
  weather_code: "Kod pogodowy",
  cloud_cover: "Zachmurzenie",
  wind_speed_10m: "Pr\u0119dko\u015B\u0107 wiatru (10m)",
  wind_direction_10m: "Kierunek wiatru (10m)",
  wind_gusts_10m: "Porywy wiatru (10m)",
  is_day: "Dzie\u0144/Noc",
  dew_point_2m: "Punkt rosy (2m)",
  wind_direction_text: "Kierunek wiatru tekst",
  weather_text: "Opis pogody",
  icon_url: "URL ikony",
  time: "Czas",
  pressure_msl: "Presione de la superficie",
  pressure_msl_mean: "\u015Arednia presione de la superficie",
  wind_gust_icon: "Icono der\xE1fagas de viento",
  wind_direction_icon: "Icono de la direcci\xF3n del viento",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "Temperatura maksymalna",
  temperature_2m_min: "Temperatura minimalna",
  sunrise: "Wsch\xF3d s\u0142o\u0144ca",
  sunset: "Zach\xF3d s\u0142o\u0144ca",
  sunshine_duration: "Czas us\u0142onecznienia",
  uv_index_max: "Maksymalny indeks UV",
  rain_sum: "Suma opad\xF3w deszczu",
  rain: "Opad",
  soil_temperature_0cm: "Temperatura ziemi (0cm)",
  snowfall: "Opad \u015Bniegu",
  snow_depth: "G\u0142\u0119boka \u015Bniegu",
  snowfall_sum: "Suma opad\xF3w \u015Bniegu",
  precipitation_probability_max: "Maks. prawdopodobie\u0144stwo opad\xF3w",
  wind_speed_10m_max: "Maksymalna pr\u0119dko\u015B\u0107 wiatru",
  wind_direction_10m_dominant: "Dominuj\u0105cy kierunek wiatru",
  wind_gusts_10m_max: "Maksymalne porywy wiatru",
  dew_point_2m_mean: "\u015Arednia temperatura punktu rosy (2m)",
  moonset: "Zach\xF3d ksi\u0119\u017Cyca",
  moonrise: "Wsch\xF3d ksi\u0119\u017Cyca",
  moon_phase_val: "Faza ksi\u0119\u017Cyca",
  moon_phase_text: "Opis fazy ksi\u0119\u017Cyca",
  moon_phase_icon: "Ikona fazy ksi\u0119\u017Cyca",
  // Luftqualität (Air Quality)
  european_aqi: "Europejski indeks jako\u015Bci powietrza",
  pm10: "Py\u0142 zawieszony PM10",
  pm2_5: "Py\u0142 zawieszony PM2.5",
  alder_pollen: "Py\u0142ek olchy",
  birch_pollen: "Py\u0142ek brzozy",
  grass_pollen: "Py\u0142ek traw",
  mugwort_pollen: "Py\u0142ek bylicy",
  ragweed_pollen: "Py\u0142ek ambrozji",
  ragweed_pollen_text: "St\u0119\u017Cenie py\u0142k\xF3w ambrozji",
  mugwort_pollen_text: "St\u0119\u017Cenie py\u0142k\xF3w bylicy",
  grass_pollen_text: "St\u0119\u017Cenie py\u0142k\xF3w traw",
  birch_pollen_text: "St\u0119\u017Cenie py\u0142k\xF3w brzozy",
  alder_pollen_text: "St\u0119\u017Cenie py\u0142k\xF3w olchy"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  pl
});
//# sourceMappingURL=pl.js.map
