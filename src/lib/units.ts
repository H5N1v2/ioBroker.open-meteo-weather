// ./lib/units.ts

export const unitMapMetric: Record<string, string> = {
	temperature: '°C',
	humidity: '%',
	precipitation_probability: '%',
	precipitation: 'mm',
	rain: 'mm',
	precipitation_sum: 'mm',
	wind_speed: 'km/h',
	wind_gusts: 'km/h',
	pm: 'µg/m³',
	dust: 'µg/m³',
	carbon_monoxide: 'µg/m³',
	ozone: 'µg/m³',
	cloud: '%',
	wind_direction: '°',
	dew_point: '°C',
	pressure: 'hPa',
	sunshine: 'h',
	snowfall: 'cm',
	snow_depth: 'm',
	alder_pollen: 'grains/m³',
	birch_pollen: 'grains/m³',
	grass_pollen: 'grains/m³',
	mugwort_pollen: 'grains/m³',
	ragweed_pollen: 'grains/m³',
	olive_pollen: 'grains/m³',
};

export const unitMapImperial: Record<string, string> = {
	temperature: '°F',
	humidity: '%',
	precipitation_probability: '%',
	precipitation: 'inch',
	precipitation_sum: 'inch',
	rain: 'inch',
	wind_speed: 'mph',
	wind_gusts: 'mph',
	pm: 'µg/m³',
	dust: 'µg/m³',
	carbon_monoxide: 'µg/m³',
	ozone: 'µg/m³',
	cloud: '%',
	wind_direction: '°',
	dew_point: '°F',
	pressure: 'inHg',
	sunshine: 'h',
	snowfall: 'inch',
	snow_depth: 'inch',
};

export const unitTranslations: Record<string, Record<string, string>> = {
	de: {
		'grains/m³': 'Körner/m³',
		'grains/m3': 'Körner/m³',
	},
	en: {
		'grains/m³': 'grains/m³',
		'grains/m3': 'grains/m3',
	},
	pl: {
		'grains/m³': 'ziaren/m³',
		'grains/m3': 'ziaren/m3',
	},
	uk: {
		'grains/m³': 'зерна/m³',
		'grains/m3': 'зерна/m3',
	},
	pt: {
		'grains/m³': 'grãos/m³',
		'grains/m3': 'grãos/m3',
	},
	zh: {
		'grains/m³': '颗/立方米',
		'grains/m3': '颗/立方米',
	},
	cn: {
		'grains/m³': '颗/立方米',
		'grains/m3': '颗/立方米',
	},
	ru: {
		'grains/m³': 'зерна/m³',
		'grains/m3': 'зерна/m3',
	},
	fr: {
		'grains/m³': 'grains/m³',
		'grains/m3': 'grains/m3',
	},
	it: {
		'grains/m³': 'grani/m³',
		'grains/m3': 'grani/m3',
	},
	nl: {
		'grains/m³': 'korrels/m³',
		'grains/m3': 'korrels/m3',
	},
	es: {
		'grains/m³': 'granos/m³',
		'grains/m3': 'granos/m3',
	},
};
