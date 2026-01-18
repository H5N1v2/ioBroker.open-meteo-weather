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
var nl_exports = {};
__export(nl_exports, {
  nl: () => nl
});
module.exports = __toCommonJS(nl_exports);
const nl = {
  // Aktuelle Werte (Current)
  temperature_2m: "Temperatuur (2m)",
  relative_humidity_2m: "Relatieve luchtvochtigheid (2m)",
  apparent_temperature: "Gevoelstemperatuur",
  precipitation: "Neerslag",
  weather_code: "Weercode",
  cloud_cover: "Bewolking",
  wind_speed_10m: "Windsnelheid (10m)",
  wind_direction_10m: "Windrichting (10m)",
  wind_gusts_10m: "Windstoten (10m)",
  is_day: "Dag/Nacht",
  dew_point_2m: "Dauwpunt (2m)",
  wind_direction_text: "Windrichting tekst",
  weather_text: "Weertekst",
  icon_url: "Icoon URL",
  time: "Tijd",
  pressure_msl: "Luchtdruk",
  pressure_msl_mean: "Gemiddelde luchtdruk",
  wind_gust_icon: "Windstoten icoon",
  wind_direction_icon: "Windrichting icoon",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "Max. temperatuur",
  temperature_2m_min: "Min. temperatuur",
  sunrise: "Zonsopgang",
  sunset: "Zonsondergang",
  sunshine_duration: "Zonneschijnduur",
  uv_index_max: "Max. UV-index",
  rain_sum: "Regensom",
  rain: "Regen",
  soil_temperature_0cm: "Bodemtemperatuur (0cm)",
  snowfall: "Sneeuwval",
  snow_depth: "Sneeuwhoogte",
  snowfall_sum: "Totale sneeuwval",
  precipitation_probability_max: "Max. neerslagkans",
  wind_speed_10m_max: "Max. windsnelheid",
  wind_direction_10m_dominant: "Overheersende windrichting",
  wind_gusts_10m_max: "Max. windstoten",
  dew_point_2m_mean: "Gemiddeld dauwpunt (2m)",
  moonset: "Maansondergang",
  moonrise: "Maansopkomst",
  moon_phase_val: "Maanfase",
  moon_phase_text: "Maanfase tekst",
  moon_phase_icon: "Maanfase icoon",
  // Luftqualität (Air Quality)
  european_aqi: "Europese luchtkwaliteitsindex",
  pm10: "Fijnstof PM10",
  pm2_5: "Fijnstof PM2.5",
  alder_pollen: "Elzenpollen",
  birch_pollen: "Berkenpollen",
  grass_pollen: "Graspollen",
  mugwort_pollen: "Bijvoetpollen",
  ragweed_pollen: "Ambrosiapollen",
  ragweed_pollen_text: "Ambrosiapollen belasting",
  mugwort_pollen_text: "Bijvoetpollen belasting",
  grass_pollen_text: "Graspollen belasting",
  birch_pollen_text: "Berkenpollen belasting",
  alder_pollen_text: "Elzenpollen belasting"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  nl
});
//# sourceMappingURL=nl.js.map
