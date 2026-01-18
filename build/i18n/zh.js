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
var zh_exports = {};
__export(zh_exports, {
  zh: () => zh
});
module.exports = __toCommonJS(zh_exports);
const zh = {
  // Aktuelle Werte (Current)
  temperature_2m: "\u6E29\u5EA6 (2\u7C73)",
  relative_humidity_2m: "\u76F8\u5BF9\u6E7F\u5EA6 (2\u7C73)",
  apparent_temperature: "\u4F53\u611F\u6E29\u5EA6",
  precipitation: "\u964D\u6C34\u91CF",
  weather_code: "\u5929\u6C14\u4EE3\u7801",
  cloud_cover: "\u4E91\u91CF",
  wind_speed_10m: "\u98CE\u901F (10\u7C73)",
  wind_direction_10m: "\u98CE\u5411 (10\u7C73)",
  wind_gusts_10m: "\u9635\u98CE (10\u7C73)",
  is_day: "\u767D\u5929/\u9ED1\u591C",
  dew_point_2m: "\u9732\u70B9 (2\u7C73)",
  wind_direction_text: "\u98CE\u5411\u6587\u672C",
  weather_text: "\u5929\u6C14\u6587\u672C",
  icon_url: "\u56FE\u6807URL",
  time: "\u65F6\u95F4",
  pressure_msl: "\u8868\u9762\u538B\u529B",
  pressure_msl_mean: "\u5E73\u5747\u8868\u9762\u538B\u529B",
  wind_gust_icon: "\u9635\u98CE\u56FE\u6807",
  wind_direction_icon: "\u98CE\u5411\u56FE\u6807",
  // Tägliche Vorhersage (Daily&Hourly)
  temperature_2m_max: "\u6700\u9AD8\u6E29\u5EA6",
  temperature_2m_min: "\u6700\u4F4E\u6E29\u5EA6",
  sunrise: "\u65E5\u51FA",
  sunset: "\u65E5\u843D",
  sunshine_duration: "\u65E5\u7167\u65F6\u957F",
  uv_index_max: "\u6700\u9AD8\u7D2B\u5916\u7EBF\u6307\u6570",
  rain_sum: "\u603B\u964D\u96E8\u91CF",
  rain: "\u96E8\u91CF",
  soil_temperature_0cm: "\u571F\u58E4\u6E29\u5EA6 (0\u5398\u7C73)",
  snowfall: "\u96EA\u91CF",
  snow_depth: "\u96EA\u6DF1",
  snowfall_sum: "\u603B\u964D\u96EA\u91CF",
  precipitation_probability_max: "\u6700\u5927\u964D\u6C34\u6982\u7387",
  wind_speed_10m_max: "\u6700\u5927\u98CE\u901F",
  wind_direction_10m_dominant: "\u4E3B\u5BFC\u98CE\u5411",
  wind_gusts_10m_max: "\u6700\u5927\u9635\u98CE",
  dew_point_2m_mean: "\u5E73\u5747\u9732\u70B9\u6E29\u5EA6 (2\u7C73)",
  moonset: "\u6708\u843D",
  moonrise: "\u6708\u51FA",
  moon_phase_val: "\u6708\u76F8",
  moon_phase_text: "\u6708\u76F8\u63CF\u8FF0",
  moon_phase_icon: "\u6708\u76F8\u56FE\u6807",
  // Luftqualität (Air Quality)
  european_aqi: "\u6B27\u6D32\u7A7A\u6C14\u8D28\u91CF\u6307\u6570",
  pm10: "PM10\u9897\u7C92\u7269",
  pm2_5: "PM2.5\u9897\u7C92\u7269",
  alder_pollen: "\u6864\u6728\u82B1\u7C89",
  birch_pollen: "\u6866\u6811\u82B1\u7C89",
  grass_pollen: "\u8349\u82B1\u7C89",
  mugwort_pollen: "\u827E\u84BF\u82B1\u7C89",
  ragweed_pollen: "\u8C5A\u8349\u82B1\u7C89",
  ragweed_pollen_text: "\u8C5A\u8349\u82B1\u7C89\u8FC7\u654F\u6307\u6570",
  mugwort_pollen_text: "\u827E\u8349\u82B1\u7C89\u8FC7\u654F\u6307\u6570",
  grass_pollen_text: "\u7267\u8349\u82B1\u7C89\u8FC7\u654F\u6307\u6570",
  birch_pollen_text: "\u6866\u6811\u82B1\u7C89\u8FC7\u654F\u6307\u6570",
  alder_pollen_text: "\u8D64\u6768\u82B1\u7C89\u8FC7\u654F\u6307\u6570"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  zh
});
//# sourceMappingURL=zh.js.map
