// Unit tests for the exported, side-effect free role mapping and unit logic.
// Mocha provides describe/it at runtime; declared here so no extra @types are needed.
import * as assert from 'node:assert';
import { getRole, ROLE_MAPPING_VERSION, MANAGED_ROLE_KEYS } from './role_mapping';
import { unitMapMetric, unitMapImperial } from './units';

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;

describe('role_mapping.getRole', () => {
	it('returns the base role for current values', () => {
		assert.strictEqual(getRole('current', 'temperature_2m'), 'value.temperature');
		assert.strictEqual(getRole('current', 'relative_humidity_2m'), 'value.humidity');
		assert.strictEqual(getRole('current', 'wind_speed_10m'), 'value.speed.wind');
	});

	it('falls back to value for unknown keys', () => {
		assert.strictEqual(getRole('current', 'totally_unknown_key'), 'value');
	});

	it('adds the daily forecast suffix for daily values', () => {
		assert.strictEqual(getRole('daily', 'temperature_2m', 0), 'value.temperature.forecast.0');
		assert.strictEqual(getRole('daily', 'temperature_2m', 3), 'value.temperature.forecast.3');
		assert.strictEqual(getRole('daily', 'temperature_2m_max', 1), 'value.temperature.max.forecast.1');
	});

	it('does not add a forecast suffix for aggregated daily keys', () => {
		assert.strictEqual(getRole('daily', 'sunshine_duration', 0), 'value.interval');
		assert.strictEqual(getRole('daily', 'precipitation_probability_max', 0), 'value.precipitation.chance');
	});

	it('downgrades certain daily keys to value from day 1 on', () => {
		assert.strictEqual(getRole('daily', 'rain_sum', 0), 'value.rain');
		assert.strictEqual(getRole('daily', 'rain_sum', 1), 'value');
		assert.strictEqual(getRole('daily', 'snowfall_sum', 1), 'value');
	});

	it('handles sunrise/sunset roles per day index', () => {
		assert.strictEqual(getRole('daily', 'sunrise', 0), 'date.sunrise');
		assert.strictEqual(getRole('daily', 'sunrise', 1), 'value');
		assert.strictEqual(getRole('daily', 'sunset', 0), 'date.sunset');
	});

	it('uses the hourly role for precipitation-like keys only at index 0', () => {
		assert.strictEqual(getRole('hourly', 'precipitation', 0), 'value.precipitation.hour');
		assert.strictEqual(getRole('hourly', 'precipitation', 1), 'value');
		assert.strictEqual(getRole('hourly', 'rain', 0), 'value.rain.hour');
		assert.strictEqual(getRole('hourly', 'snowfall', 2), 'value');
	});

	it('maps sunshine_duration to a duration role (value.interval)', () => {
		assert.strictEqual(getRole('current', 'sunshine_duration'), 'value.interval');
		assert.strictEqual(getRole('hourly', 'sunshine_duration', 0), 'value.interval');
		assert.strictEqual(getRole('daily', 'sunshine_duration', 0), 'value.interval');
	});

	it('keeps the managed role keys in sync with the mapping', () => {
		assert.ok(MANAGED_ROLE_KEYS.has('temperature_2m'));
		assert.ok(MANAGED_ROLE_KEYS.has('sunshine_duration'));
		assert.ok(!MANAGED_ROLE_KEYS.has('icon_url'));
		assert.ok(!MANAGED_ROLE_KEYS.has('weather_text'));
		assert.strictEqual(ROLE_MAPPING_VERSION, 2);
	});
});

describe('units', () => {
	it('provides metric units', () => {
		assert.strictEqual(unitMapMetric.temperature, '°C');
		assert.strictEqual(unitMapMetric.sunshine, 'h');
		assert.strictEqual(unitMapMetric.wind_speed, 'km/h');
	});

	it('provides imperial units', () => {
		assert.strictEqual(unitMapImperial.temperature, '°F');
		assert.strictEqual(unitMapImperial.wind_speed, 'mph');
	});
});
