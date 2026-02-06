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
var units_exports = {};
__export(units_exports, {
  unitMapImperial: () => unitMapImperial,
  unitMapMetric: () => unitMapMetric,
  unitTranslations: () => unitTranslations
});
module.exports = __toCommonJS(units_exports);
const unitMapMetric = {
  temperature: "\xB0C",
  humidity: "%",
  precipitation_probability: "%",
  precipitation: "mm",
  rain: "mm",
  precipitation_sum: "mm",
  wind_speed: "km/h",
  wind_gusts: "km/h",
  pm: "\xB5g/m\xB3",
  dust: "\xB5g/m\xB3",
  carbon_monoxide: "\xB5g/m\xB3",
  ozone: "\xB5g/m\xB3",
  cloud: "%",
  wind_direction: "\xB0",
  dew_point: "\xB0C",
  pressure: "hPa",
  sunshine: "h",
  snowfall: "cm",
  snow_depth: "m",
  alder_pollen: "grains/m\xB3",
  birch_pollen: "grains/m\xB3",
  grass_pollen: "grains/m\xB3",
  mugwort_pollen: "grains/m\xB3",
  ragweed_pollen: "grains/m\xB3",
  olive_pollen: "grains/m\xB3"
};
const unitMapImperial = {
  temperature: "\xB0F",
  humidity: "%",
  precipitation_probability: "%",
  precipitation: "inch",
  precipitation_sum: "inch",
  rain: "inch",
  wind_speed: "mph",
  wind_gusts: "mph",
  pm: "\xB5g/m\xB3",
  dust: "\xB5g/m\xB3",
  carbon_monoxide: "\xB5g/m\xB3",
  ozone: "\xB5g/m\xB3",
  cloud: "%",
  wind_direction: "\xB0",
  dew_point: "\xB0F",
  pressure: "inHg",
  sunshine: "h",
  snowfall: "inch",
  snow_depth: "inch"
};
const unitTranslations = {
  de: {
    "grains/m\xB3": "K\xF6rner/m\xB3",
    "grains/m3": "K\xF6rner/m\xB3"
  },
  en: {
    "grains/m\xB3": "grains/m\xB3",
    "grains/m3": "grains/m3"
  },
  pl: {
    "grains/m\xB3": "ziaren/m\xB3",
    "grains/m3": "ziaren/m3"
  },
  uk: {
    "grains/m\xB3": "\u0437\u0435\u0440\u043D\u0430/m\xB3",
    "grains/m3": "\u0437\u0435\u0440\u043D\u0430/m3"
  },
  pt: {
    "grains/m\xB3": "gr\xE3os/m\xB3",
    "grains/m3": "gr\xE3os/m3"
  },
  zh: {
    "grains/m\xB3": "\u9897/\u7ACB\u65B9\u7C73",
    "grains/m3": "\u9897/\u7ACB\u65B9\u7C73"
  },
  cn: {
    "grains/m\xB3": "\u9897/\u7ACB\u65B9\u7C73",
    "grains/m3": "\u9897/\u7ACB\u65B9\u7C73"
  },
  ru: {
    "grains/m\xB3": "\u0437\u0435\u0440\u043D\u0430/m\xB3",
    "grains/m3": "\u0437\u0435\u0440\u043D\u0430/m3"
  },
  fr: {
    "grains/m\xB3": "grains/m\xB3",
    "grains/m3": "grains/m3"
  },
  it: {
    "grains/m\xB3": "grani/m\xB3",
    "grains/m3": "grani/m3"
  },
  nl: {
    "grains/m\xB3": "korrels/m\xB3",
    "grains/m3": "korrels/m3"
  },
  es: {
    "grains/m\xB3": "granos/m\xB3",
    "grains/m3": "granos/m3"
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  unitMapImperial,
  unitMapMetric,
  unitTranslations
});
//# sourceMappingURL=units.js.map
