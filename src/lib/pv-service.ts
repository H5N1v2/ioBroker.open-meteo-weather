import { ApiCaller } from './pv-api';
import * as SunCalc from 'suncalc';

/**
 * Service for fetching, processing, and exposing PV forecast data.
 */
export class PVService {
	private adapter: any;
	private apiCaller!: ApiCaller;
	private updateInterval: NodeJS.Timeout | null = null;
	private astroTimeout: NodeJS.Timeout | null = null;

	/**
	 * Creates a new PV service instance.
	 *
	 * @param adapter The ioBroker adapter instance.
	 */
	constructor(adapter: any) {
		this.adapter = adapter;
	}

	/**
	 * Initializes the PV service and starts the queries.
	 */
	public async init(): Promise<void> {
		if (!this.adapter.config.pv_locations || this.adapter.config.pv_locations.length === 0) {
			this.adapter.log.warn('PV-Forecast: No locations configured.');
			return;
		}

		this.apiCaller = new ApiCaller(this.adapter);
		this.adapter.log.info('Starting PV-Forecast Service...');

		this.adapter.config.pv_forecastHours = this.adapter.config.pv_forecastHours || 24;
		this.adapter.config.pv_forecastDays = this.adapter.config.pv_forecastDays || 7;

		await this.cleanupStaleObjects();
		await this.createStatesForLocations();
		await this.updateAllLocations();

		// Timer aufräumen
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		if (this.astroTimeout) {
			clearTimeout(this.astroTimeout);
			this.astroTimeout = null;
		}

		const configValue = this.adapter.config.pv_updateInterval;
		if (configValue === 'sunrise') {
			this.adapter.getForeignObject('system.config', (err: Error | null | undefined, obj: any) => {
				if (err) {
					this.adapter.log.error(`System Check - Error reading config: ${err.message}`);
					return;
				}

				if (obj?.common?.latitude && obj?.common?.longitude) {
					this.adapter.log.debug(
						`System Check for once before sunrise - Lat: ${obj.common.latitude}, Long: ${obj.common.longitude}`,
					);
				} else {
					this.adapter.log.warn(
						'System Check for once before sunrise - Latitude/Longitude missing in ioBroker system settings!',
					);
				}
			});
		}

		if (configValue === 'sunrise') {
			this.adapter.log.info('PV update scheduled: daily before sunrise');
			this.scheduleSunriseUpdate(); // Aufruf ohne "adapter", da die Methode hier unten drunter steht
		} else {
			const intervalMinutes = Number(configValue || 60);
			if (intervalMinutes > 0) {
				this.adapter.log.info(`PV update scheduled: every ${intervalMinutes} minutes`);
				this.updateInterval = setInterval(
					() => {
						void this.updateAllLocations();
					},
					intervalMinutes * 60 * 1000,
				);
			}
		}
	}

	private scheduleSunriseUpdate(): void {
		this.adapter.getForeignObject('system.config', (err: Error | null | undefined, obj: any) => {
			if (err || !obj || !obj.common || obj.common.latitude === undefined) {
				this.adapter.log.error('PV-Service: Coordinates could not be read from system.config.');
				return;
			}

			const lat: number = obj.common.latitude;
			const lng: number = obj.common.longitude;
			const now = new Date();

			try {
				const times = SunCalc.getTimes(now, lat, lng);
				let sunrise = times.sunrise;
				let targetTime = new Date(sunrise.getTime() - 15 * 60 * 1000);

				if (targetTime <= now) {
					const tomorrow = new Date();
					tomorrow.setDate(tomorrow.getDate() + 1);
					const tomorrowTimes = SunCalc.getTimes(tomorrow, lat, lng);
					sunrise = tomorrowTimes.sunrise;
					targetTime = new Date(sunrise.getTime() - 15 * 60 * 1000);
				}

				const msToWait = targetTime.getTime() - Date.now();

				this.adapter.log.info(
					`Next PV call-off planned for: ${targetTime.toLocaleString()} (Sunrise is at ${sunrise.toLocaleTimeString()})`,
				);

				if (this.astroTimeout) {
					this.adapter.clearTimeout(this.astroTimeout);
				}

				this.astroTimeout = this.adapter.setTimeout(async () => {
					this.adapter.log.info('Scheduled PV update is being executed...');
					try {
						await this.updateAllLocations();
					} catch (error) {
						this.adapter.log.error(`Error during PV update: ${String(error)}`);
					}
					this.scheduleSunriseUpdate();
				}, msToWait);
			} catch (e: any) {
				this.adapter.log.error(`Error during astro calculation: ${String(e)}`);
			}
		});
	}

	private async cleanupStaleObjects(): Promise<void> {
		this.adapter.log.debug('Starting cleanup of stale objects...');

		const sumChannels = [
			{ id: 'sum_peak_locations_Daily', configKey: 'locationsTotal_daily', masterKey: null },
			{ id: 'sum_peak_locations_Hourly', configKey: 'locationsTotal_hourly', masterKey: null },
			{ id: 'sum_peak_locations_15_Minutely', configKey: 'locationsTotal_minutely', masterKey: 'minutes_15' },
		];

		// 1. Summen-Channels bereinigen
		for (const channel of sumChannels) {
			const masterDisabled = channel.masterKey && !this.adapter.config[channel.masterKey];
			const sumOptionDisabled = !this.adapter.config[channel.configKey as keyof ioBroker.AdapterConfig];
			const tooFewLocations = this.adapter.config.pv_locations.length <= 1;

			if (!this.adapter.config.locationsTotal || tooFewLocations || sumOptionDisabled || masterDisabled) {
				const sumObj = await this.adapter.getObjectAsync(channel.id);
				if (sumObj) {
					await this.adapter.delObjectAsync(channel.id, { recursive: true });
					this.adapter.log.info(`Cleanup: Deleted summary channel ${channel.id}`);
				}
			}
		}

		// 2. Locations und Unterordner bereinigen
		const configuredNames = new Set(
			this.adapter.config.pv_locations.map((l: any) => this.sanitizeLocationName(l.name)),
		);
		const allObjects = await this.adapter.getAdapterObjectsAsync();

		for (const fullId of Object.keys(allObjects)) {
			const localId = fullId.replace(`${this.adapter.namespace}.`, '');
			const parts = localId.split('.');

			// Nur Objekte unter pv-forecast verarbeiten
			if (parts[0] !== 'pv-forecast' || parts.length < 2) {
				continue;
			}

			const locName = parts[1];

			// Summen-Ordner ignorieren
			if (
				['sum_peak_locations_Daily', 'sum_peak_locations_Hourly', 'sum_peak_locations_15_Minutely'].includes(
					locName,
				)
			) {
				continue;
			}

			// A) Falls Location komplett aus Config entfernt
			if (!configuredNames.has(locName)) {
				if (parts.length === 2) {
					await this.adapter.delObjectAsync(localId, { recursive: true });
					this.adapter.log.info(`Cleanup: Deleted removed PV location: ${locName}`);
				}
				continue;
			}

			// B) Falls Location existiert -> Unterordner/Optionen prüfen

			// 1. Check Cloud Cover (Hourly)
			if (localId.includes('.hourly-forecast.hour') && localId.endsWith('.cloud_cover')) {
				if (!this.adapter.config.cloud_cover) {
					await this.adapter.delObjectAsync(localId);
					this.adapter.log.debug(`Cleanup: Removed disabled cloud_cover: ${localId}`);
					continue; // Objekt gelöscht, weiter zum nächsten
				}
			}

			// 2. Check Sunshine Duration (Hourly & 15-Min)
			if (localId.endsWith('.sunshine_duration')) {
				if (!this.adapter.config.sunshine_duration) {
					await this.adapter.delObjectAsync(localId);
					this.adapter.log.debug(`Cleanup: Removed disabled sunshine_duration: ${localId}`);
					continue;
				}
			}

			// 3. Check 15-Minuten Forecast generell
			if (localId.includes('.15-min-forecast') && !this.adapter.config.minutes_15) {
				await this.adapter.delObjectAsync(localId, { recursive: true });
				continue;
			}

			// 4. Tage Check (wie gehabt)
			const dayMatch = localId.match(/\.daily-forecast\.day(\d+)$/);
			if (dayMatch) {
				const dayIndex = parseInt(dayMatch[1]);
				if (dayIndex >= this.adapter.config.forecastDays) {
					await this.adapter.delObjectAsync(localId, { recursive: true });
					continue;
				}
			}

			// 5. Stunden Check (wie gehabt)
			const hourMatch = localId.match(/\.hourly-forecast\.hour(\d+)$/);
			if (hourMatch) {
				const hourIndex = parseInt(hourMatch[1]);
				if (hourIndex >= (this.adapter.config.pv_forecastHours || 24)) {
					await this.adapter.delObjectAsync(localId, { recursive: true });
					continue;
				}
			}

			// 6. JSON Charts (wie gehabt)
			if (localId.endsWith('.15-min-json_chart') && !this.adapter.config.minutes_15_json) {
				await this.adapter.delObjectAsync(localId);
				continue;
			}
			if (localId.endsWith('.hourly-json_chart') && !this.adapter.config.hours_json) {
				await this.adapter.delObjectAsync(localId);
				continue;
			}
		}

		// 3. Globale Summen JSON Charts
		if (
			!this.adapter.config.locationsTotal_minutely_json ||
			!this.adapter.config.minutes_15 ||
			this.adapter.config.pv_locations.length <= 1
		) {
			const jsonObj = await this.adapter.getObjectAsync('pv-forecast.sum_peak_15-min-json_chart');
			if (jsonObj) {
				await this.adapter.delObjectAsync('pv-forecast.sum_peak_15-min-json_chart');
			}
		}

		this.adapter.log.debug('Cleanup finished.');
	}

	private async createStatesForLocations(): Promise<void> {
		await this.adapter.extendObjectAsync('info.lastUpdate_PV_Forecast', {
			type: 'state',
			common: {
				name: {
					en: 'Last Update PV Forecast',
					de: 'Letztes Update PV-Vorhersage',
					pl: 'Ostatnia aktualizacja prognozy PV',
					ru: 'Последнее обновление прогноза PV',
					it: 'Ultimo aggiornamento previsione PV',
					es: 'Última actualización pronóstico PV',
					'zh-cn': '最后更新 PV 预测',
					fr: 'Dernière mise à jour prévision PV',
					pt: 'Última atualização previsão PV',
					nl: 'Laatste update PV-voorspelling',
					uk: 'Останнє оновлення прогнозу PV',
				},
				type: 'string',
				role: 'date',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.adapter.setObjectNotExistsAsync('pv-forecast', {
			type: 'channel',
			common: { name: 'PV Forecast' },
			role: 'info',
			native: {},
		});

		for (const location of this.adapter.config.pv_locations) {
			const locationName = `${this.sanitizeLocationName(location.name)}`;
			const base = `pv-forecast.${locationName}`;

			await this.adapter.setObjectNotExistsAsync(base, {
				type: 'device',
				common: { name: location.name },
				native: {},
			});

			await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast`, {
				type: 'channel',
				common: {
					name: {
						en: 'Hourly Forecast',
						de: 'Stündliche Vorhersage',
						ru: 'Почасовой прогноз',
						pt: 'Previsão horária',
						nl: 'Uurlijkse voorspelling',
						fr: 'Prévisions horaires',
						it: 'Previsioni orarie',
						es: 'Pronóstico por hora',
						pl: 'Prognoza godzinowa',
						uk: 'Погодинний прогноз',
						'zh-cn': '逐小时预报',
					},
				},
				native: {},
			});

			for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}`, {
					type: 'channel',
					common: {
						name: {
							en: `Hour ${hour}`,
							de: `Stunde ${hour}`,
							ru: `Час ${hour}`,
							pt: `Hora ${hour}`,
							nl: `Uur ${hour}`,
							fr: `Heure ${hour}`,
							it: `Ora ${hour}`,
							es: `Hora ${hour}`,
							pl: `Godzina ${hour}`,
							uk: `Година ${hour}`,
							'zh-cn': `小时 ${hour}`,
						},
					},
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.time`, {
					type: 'state',
					common: {
						name: {
							en: 'Hour Time',
							de: 'Stundenzeit',
							ru: 'Час Время',
							pt: 'Hora',
							nl: 'Uur Tijd',
							fr: 'Heure',
							it: 'Ora Ora',
							es: 'Hora Tiempo',
							pl: 'Godzina Czas',
							uk: 'Година Час',
							'zh-cn': '小时',
						},
						type: 'string',
						role: 'date',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.unix_time_stamp`, {
					type: 'state',
					common: {
						name: {
							en: 'Unix Time Stamp',
							de: 'Unix-Zeitstempel',
							ru: 'Unix-временная метка',
							pt: 'Carimbo de tempo Unix',
							nl: 'Unix-tijdstempel',
							fr: 'Horodatage Unix',
							it: 'Timestamp Unix',
							es: 'Marca de tiempo Unix',
							pl: 'Znacznik czasu Unix',
							uk: 'Unix-мітка часу',
							'zh-cn': 'Unix时间戳',
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
					},
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(
					`${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`,
					{
						type: 'state',
						common: {
							name: {
								en: 'Global Tilted Irradiance',
								de: 'Globale Strahlung auf geneigter Fläche',
								ru: 'Глобальная наклонная освещенность',
								pt: 'Irradiância Global Inclinada',
								nl: 'Globale gekantelde instraling',
								fr: 'Irradiance globale inclinée',
								it: 'Irradianza inclinata globale',
								es: 'Irradiancia global inclinada',
								pl: 'Globalne pochylone natężenie promieniowania',
								uk: 'Глобальне нахилене випромінювання',
								'zh-cn': '全球倾斜辐照度',
							},
							type: 'number',
							role: 'value.energy',
							unit: 'Wh',
							read: true,
							write: false,
						},
						native: {},
					},
				);
				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.temperature_2m`, {
					type: 'state',
					common: {
						name: {
							en: 'Temperature 2m',
							de: 'Temperatur 2 m',
							ru: 'Температура 2 м',
							pt: 'Temperatura 2m',
							nl: 'Temperatuur 2m',
							fr: 'Température 2m',
							it: 'Temperatura 2m',
							es: 'Temperatura 2m',
							pl: 'Temperatura 2m',
							uk: 'Температура 2 м',
							'zh-cn': '温度 2 米',
						},
						type: 'number',
						role: 'value.temperature',
						unit: '°C',
						read: true,
						write: false,
					},
					native: {},
				});
				if (this.adapter.config.cloud_cover) {
					await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.cloud_cover`, {
						type: 'state',
						common: {
							name: {
								en: 'Cloud Cover',
								de: 'Wolkenbedeckung',
								ru: 'Облачность',
								pt: 'Cobertura de nuvens',
								nl: 'Bewolking',
								fr: 'Couverture nuageuse',
								it: 'Copertura nuvolosa',
								es: 'Cobertura de nubes',
								pl: 'Zachmurzenie',
								uk: 'Хмарний покрив',
								'zh-cn': '云层覆盖',
							},
							type: 'number',
							role: 'value.clouds',
							unit: '%',
							read: true,
							write: false,
						},
						native: {},
					});
				}

				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.wind_speed_10m`, {
					type: 'state',
					common: {
						name: {
							en: 'Wind Speed 10m',
							de: 'Windgeschwindigkeit 10 m',
							ru: 'Скорость ветра 10 м',
							pt: 'Velocidade do vento 10m',
							nl: 'Windsnelheid 10 m',
							fr: 'Vitesse du vent 10 m',
							it: 'Velocità del vento 10 m',
							es: 'Velocidad del viento 10m',
							pl: 'Prędkość wiatru 10m',
							uk: 'Швидкість вітру 10 м',
							'zh-cn': '风速 10 米',
						},
						type: 'number',
						role: 'value.speed.wind',
						unit: 'km/h',
						read: true,
						write: false,
					},
					native: {},
				});
				if (this.adapter.config.sunhine_duration) {
					await this.adapter.setObjectNotExistsAsync(
						`${base}.hourly-forecast.hour${hour}.sunshine_duration`,
						{
							type: 'state',
							common: {
								name: {
									en: 'Sunshine Duration',
									de: 'Sonnenscheindauer',
									ru: 'Продолжительность солнечного сияния',
									pt: 'Duração da luz solar',
									nl: 'Zonneschijnduur',
									fr: "Durée d'ensoleillement",
									it: 'Durata del sole',
									es: 'Duración de la luz solar',
									pl: 'Czas trwania nasłonecznienia',
									uk: 'Тривалість сонячного світла',
									'zh-cn': '日照时长',
								},
								type: 'number',
								role: 'value',
								unit: 'min',
								read: true,
								write: false,
							},
							native: {},
						},
					);
				}

				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-forecast.hour${hour}.pv_temperature`, {
					type: 'state',
					common: {
						name: {
							en: 'Estimated PV Module Temperature',
							de: 'Geschätzte PV-Modultemperatur',
							ru: 'Расчетная температура фотоэлектрического модуля',
							pt: 'Temperatura estimada do módulo fotovoltaico',
							nl: 'Geschatte temperatuur van de PV-module',
							fr: 'Température estimée du module PV',
							it: 'Temperatura stimata del modulo fotovoltaico',
							es: 'Temperatura estimada del módulo fotovoltaico',
							pl: 'Szacowana temperatura modułu fotowoltaicznego',
							uk: 'Розрахункова температура фотоелектричного модуля',
							'zh-cn': '光伏组件预估温度',
						},
						type: 'number',
						role: 'value.temperature',
						unit: '°C',
						read: true,
						write: false,
					},
					native: {},
				});
			}

			await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast`, {
				type: 'channel',
				common: {
					name: {
						en: 'Daily Forecast',
						de: 'Tägliche Prognose',
						ru: 'Ежедневный прогноз',
						pt: 'Previsão diária',
						nl: 'Dagelijkse voorspelling',
						fr: 'Prévision quotidienne',
						it: 'Previsione giornaliera',
						es: 'Pronóstico diario',
						pl: 'Prognoza dzienna',
						uk: 'Щоденний прогноз',
						'zh-cn': '每日预测',
					},
				},
				native: {},
			});

			for (let day = 0; day < this.adapter.config.forecastDays; day++) {
				await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}`, {
					type: 'channel',
					common: {
						name: {
							en: `Day ${day}`,
							de: `Tag ${day}`,
							ru: `День ${day}`,
							pt: `Dia ${day}`,
							nl: `Dag ${day}`,
							fr: `Jour ${day}`,
							it: `Giorno ${day}`,
							es: `Día ${day}`,
							pl: `Dzień ${day}`,
							uk: `День ${day}`,
							'zh-cn': `天 ${day}`,
						},
					},
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}.Date`, {
					type: 'state',
					common: {
						name: {
							en: 'Date',
							de: 'Datum',
							ru: 'Дата',
							pt: 'Data',
							nl: 'Datum',
							fr: 'Date',
							it: 'Data',
							es: 'Fecha',
							pl: 'Data',
							uk: 'Дата',
							'zh-cn': '日期',
						},
						type: 'string',
						role: 'text',
						read: true,
						write: false,
					},
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(`${base}.daily-forecast.day${day}.Peak_day`, {
					type: 'state',
					common: {
						name: {
							en: 'Daily Peak Energy',
							de: 'Tägliche Spitzenenergie',
							ru: 'Ежедневный пик энергии',
							pt: 'Energia de pico diária',
							nl: 'Dagelijkse piekenergie',
							fr: 'Énergie maximale quotidienne',
							it: 'Energia di picco giornaliera',
							es: 'Energía máxima diaria',
							pl: 'Dzienny szczyt energetyczny',
							uk: 'Добовий піковий енергоспоживання',
							'zh-cn': '每日峰值能量',
						},
						type: 'number',
						role: 'value.energy',
						unit: 'Wh',
						read: true,
						write: false,
					},
					native: {},
				});
			}

			if (this.adapter.config.locationsTotal && this.adapter.config.pv_locations.length > 1) {
				const sumBase = 'pv-forecast';
				await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Daily`, {
					type: 'channel',
					common: {
						name: {
							en: 'Sum Peak from Locations Daily',
							de: 'Tägliche Summe der Spitzenwerte von Standorten',
							ru: 'Суммарный пик из различных мест ежедневно',
							pt: 'Pico de soma de locais diários',
							nl: 'Som van pieken van locaties dagelijks',
							fr: 'Somme des pics quotidiens à partir des emplacements',
							it: 'Somma Picco dalle Posizioni Giornaliere',
							es: 'Suma de picos desde ubicaciones diarias',
							pl: 'Sum Peak z lokalizacji dziennie',
							uk: 'Сума Пік з місць розташування щодня',
							'zh-cn': '每日位置的 Sum Peak',
						},
					},
					native: {},
				});

				for (let day = 0; day < this.adapter.config.forecastDays; day++) {
					await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Daily.day${day}`, {
						type: 'channel',
						common: {
							name: {
								en: `Day ${day}`,
								de: `Tag ${day}`,
								ru: `День ${day}`,
								pt: `Dia ${day}`,
								nl: `Dag ${day}`,
								fr: `Jour ${day}`,
								it: `Giorno ${day}`,
								es: `Día ${day}`,
								pl: `Dzień ${day}`,
								uk: `День ${day}`,
								'zh-cn': `天 ${day}`,
							},
						},
						native: {},
					});

					await this.adapter.setObjectNotExistsAsync(
						`${sumBase}.sum_peak_locations_Daily.day${day}.sum_locations`,
						{
							type: 'state',
							common: {
								name: {
									en: 'Sum of all locations',
									de: 'Summe aller Standorte',
									ru: 'Сумма всех мест',
									pt: 'Soma de todas as localizações',
									nl: 'Som van alle locaties',
									fr: 'Somme de tous les emplacements',
									it: 'Somma di tutte le posizioni',
									es: 'Suma de todas las ubicaciones',
									pl: 'Suma wszystkich lokalizacji',
									uk: 'Сума всіх місць розташування',
									'zh-cn': '所有位置的总和',
								},
								type: 'number',
								role: 'value.energy',
								unit: 'Wh',
								read: true,
								write: false,
							},
							native: {},
						},
					);
				}
			}
			if (this.adapter.config.minutes_15) {
				// 1. Haupt-Channel erstellen
				await this.adapter.setObjectNotExistsAsync(`${base}.15-min-forecast`, {
					type: 'channel',
					common: {
						name: {
							en: '15-Minute Forecast',
							de: '15-Minuten-Vorhersage',
							ru: '15-минутный прогноз',
							pt: 'Previsão de 15 minutos',
							nl: '15-minutenvoorspelling',
							fr: 'Prévisions à 15 minutes',
							it: 'Previsioni a 15 minuti',
							es: 'Previsión en 15 minutos',
							pl: '15-minutowa prognoza',
							uk: '15-хвилинний прогноз',
							'zh-cn': '15-Minute Forecast',
						},
					},
					native: {},
				});

				// Definition der Datenpunkte pro 15-Min-Schritt
				const states = {
					unix_time_stamp: {
						name: {
							en: 'unix time stamp',
							de: 'Unix-Zeitstempel',
							ru: 'Unix-временная метка',
							pt: 'Carimbo de tempo Unix',
							nl: 'Unix-tijdstempel',
							fr: 'Horodatage Unix',
							it: 'Timestamp Unix',
							es: 'Sello de tiempo Unix',
							pl: 'Znacznik czasu Unix',
							uk: 'Unix-мітка часу',
							'zh-cn': 'Unix时间戳',
						},
						type: 'number',
						role: 'value.time',
						unit: '',
					},
					time: {
						name: {
							en: 'formatted time',
							de: 'Formatierte Zeit',
							ru: 'Отформатированное время',
							pt: 'Hora formatada',
							nl: 'Opgemaakte tijd',
							fr: 'Heure formatée',
							it: 'Ora formattata',
							es: 'Hora formateada',
							pl: 'Sformatowany czas',
							uk: 'Відформатований час',
							'zh-cn': '格式化时间',
						},
						type: 'string',
						role: 'text',
						unit: '',
					},
					global_tilted_irradiance: {
						name: {
							en: 'Irradiance',
							de: 'Einstrahlung',
							ru: 'Освещенность',
							pt: 'Irradiância',
							nl: 'Straling',
							fr: 'Irradiance',
							it: 'Irradianza',
							es: 'Irradiancia',
							pl: 'Promieniowanie',
							uk: 'Опромінення',
							'zh-cn': '辐照度',
						},
						type: 'number',
						role: 'value.energy',
						unit: 'Wh',
					},
					temperature_2m: {
						name: {
							en: 'Temperature',
							de: 'Temperatur',
							ru: 'Температура',
							pt: 'Temperatura',
							nl: 'Temperatuur',
							fr: 'Température',
							it: 'Temperatura',
							es: 'Temperatura',
							pl: 'Temperatura',
							uk: 'Температура',
							'zh-cn': '温度',
						},
						type: 'number',
						role: 'value.temperature',
						unit: '°C',
					},
					wind_speed_10m: {
						name: {
							en: 'Wind speed',
							de: 'Windgeschwindigkeit',
							ru: 'Скорость ветра',
							pt: 'Velocidade do vento',
							nl: 'Windsnelheid',
							fr: 'Vitesse du vent',
							it: 'Velocità del vento',
							es: 'Velocidad del viento',
							pl: 'Prędkość wiatru',
							uk: 'Швидкість вітру',
							'zh-cn': '风速',
						},
						type: 'number',
						role: 'value.speed.wind',
						unit: 'km/h',
					},
					sunshine_duration: {
						name: {
							en: 'Sunshine duration',
							de: 'Sonnenscheindauer',
							ru: 'Продолжительность солнечного сияния',
							pt: 'Duração da luz solar',
							nl: 'Duur van de zonneschijn',
							fr: "Durée d'ensoleillement",
							it: 'Durata del sole',
							es: 'Duración del sol',
							pl: 'Czas nasłonecznienia',
							uk: 'Тривалість сонячного сяйва',
							'zh-cn': 'Sunshine duration',
						},
						type: 'number',
						role: 'value',
						unit: 'min',
					},
				};

				// Schleife für die Intervalle
				for (let i = 0; i < 96; i++) {
					const channelId = `pv-forecast.${locationName}.15-min-forecast.${i}`;

					// Unter-Channel für den Zeitschritt erstellen
					await this.adapter.setObjectNotExistsAsync(channelId, {
						type: 'channel',
						common: { name: `Interval ${i}` },
						native: {},
					});

					// Alle Datenpunkte innerhalb des Intervalls erstellen
					for (const [key, info] of Object.entries(states)) {
						const locationName = this.sanitizeLocationName(location.name);
						if (key === 'sunshine_duration' && !this.adapter.config.sunshine_duration) {
							continue;
						}
						const base = `pv-forecast.${locationName}`;
						await this.adapter.setObjectNotExistsAsync(`${channelId}.${key}`, {
							type: 'state',
							common: {
								name: info.name,
								type: info.type as any,
								role: info.role,
								unit: info.unit,
								read: true,
								write: false,
							},
							native: {},
						});
						await this.adapter.setObjectNotExistsAsync(`${base}.15-min-forecast.${i}.pv_temperature`, {
							type: 'state',
							common: {
								name: {
									en: 'Estimated PV Module Temperature',
									de: 'Geschätzte PV-Modultemperatur',
									ru: 'Расчетная температура фотоэлектрического модуля',
									pt: 'Temperatura estimada do módulo fotovoltaico',
									nl: 'Geschatte temperatuur van de PV-module',
									fr: 'Température estimée du module PV',
									it: 'Temperatura stimata del modulo fotovoltaico',
									es: 'Temperatura estimada del módulo fotovoltaico',
									pl: 'Szacowana temperatura modułu fotowoltaicznego',
									uk: 'Розрахункова температура фотоелектричного модуля',
									'zh-cn': '光伏组件预估温度',
								},
								type: 'number',
								role: 'value.temperature',
								unit: '°C',
								read: true,
								write: false,
							},
							native: {},
						});
					}
				}
			}
			// Optional: JSON-Chart-Datenpunkt für 15-Minuten-Vorhersage
			if (this.adapter.config.minutes_15_json) {
				await this.adapter.setObjectNotExistsAsync(`${base}.15-min-json_chart`, {
					type: 'state',
					common: {
						name: {
							en: 'JSON Chart Data',
							de: 'JSON-Diagrammdaten',
							ru: 'Данные диаграммы в формате JSON',
							pt: 'Dados do gráfico JSON',
							nl: 'JSON-grafiekgegevens',
							fr: 'Données du graphique JSON',
							it: 'Dati del grafico JSON',
							es: 'Datos de gráficos JSON',
							pl: 'Dane wykresu JSON',
							uk: 'Дані діаграми JSON',
							'zh-cn': 'JSON 图表数据',
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						desc: {
							en: 'History data for eCharts in JSON format',
							de: 'Verlaufsdaten für eCharts im JSON-Format',
							ru: 'Исторические данные для eCharts в формате JSON',
							pt: 'Dados históricos do eCharts em formato JSON',
							nl: 'Historische gegevens voor eCharts in JSON-formaat.',
							fr: 'Données historiques pour eCharts au format JSON',
							it: 'Dati storici per eCharts in formato JSON',
							es: 'Datos históricos de eCharts en formato JSON',
							pl: 'Dane historyczne dla eCharts w formacie JSON',
							uk: 'Історичні дані для eCharts у форматі JSON',
							'zh-cn': 'eCharts 的历史数据（JSON 格式）',
						},
					},
					native: {},
				});
			}
			// Optional: JSON-Chart-Datenpunkt für Stunden-Vorhersage
			if (this.adapter.config.hours_json) {
				await this.adapter.setObjectNotExistsAsync(`${base}.hourly-json_chart`, {
					type: 'state',
					common: {
						name: {
							en: 'JSON Chart Data Hours',
							de: 'JSON-Diagrammdaten Stunden',
							ru: 'Данные диаграммы в формате JSON Часы',
							pt: 'Dados do gráfico JSON Horas',
							nl: 'JSON-grafiekgegevens Uren',
							fr: 'Données du graphique JSON Heures',
							it: 'Dati del grafico JSON Ore',
							es: 'Datos de gráficos JSON Horas',
							pl: 'Dane wykresu JSON Godziny',
							uk: 'Дані діаграми JSON Години',
							'zh-cn': 'JSON 图表数据 小时',
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						desc: {
							en: 'Hour History data for eCharts in JSON format',
							de: 'Stündliche Verlaufsdaten für eCharts im JSON-Format',
							ru: 'Часовые исторические данные для eCharts в формате JSON',
							pt: 'Dados históricos por hora do eCharts em formato JSON',
							nl: 'Uur historische gegevens voor eCharts in JSON-formaat.',
							fr: 'Données historiques horaires pour eCharts au format JSON',
							it: 'Dati storici orari per eCharts in formato JSON',
							es: 'Datos históricos por hora de eCharts en formato JSON',
							pl: 'Godzinowe dane historyczne dla eCharts w formacie JSON',
							uk: 'Погодинні історичні дані для eCharts у форматі JSON',
							'zh-cn': 'eCharts 的历史数据（按小时，JSON 格式）',
						},
					},
					native: {},
				});
			}
			if (
				this.adapter.config.locationsTotal_minutely_json &&
				this.adapter.config.minutes_15 &&
				this.adapter.config.pv_locations.length > 1
			) {
				const sumBase = 'pv-forecast';
				await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_15-min-json_chart`, {
					type: 'state',
					common: {
						name: {
							en: 'Sum JSON Chart Data 15 minutes',
							de: 'Summe JSON Diagramm Daten 15 Minuten',
							ru: 'Суммарные данные JSON за 15 минут',
							pt: 'Sum JSON Dados do Gráfico 15 minutos',
							nl: 'Sum JSON Grafiekgegevens 15 minuten',
							fr: 'Sum JSON Données du graphique 15 minutes',
							it: 'Sum JSON Grafico Dati 15 minuti',
							es: 'Sum JSON Datos de carga 15 minutos',
							pl: 'Sum JSON Wykres Dane 15 minut',
							uk: 'Сума JSON Графік даних 15 хвилин',
							'zh-cn': 'JSON总和 图表 15分钟',
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						desc: {
							en: 'Sum History data for eCharts in JSON format',
							de: 'Summe für eCharts im JSON-Format',
							ru: 'Данные истории сумм для электронных диаграммы в формате JSON',
							pt: 'Dados do Sum History para eCharts em JSON',
							nl: 'Som geschiedenisgegevens voor eCharts in JSON-formaat',
							fr: 'Historique des sommes pour eCharts au format JSON',
							it: 'Sum History per eCharts in formato JSON',
							es: 'Sumar datos históricos de ECharts en formato JSON',
							pl: 'Suma danych historii dla eCharts w formacie JSON',
							uk: 'Сума даних історії для eCharts у форматі JSON',
							'zh-cn': '以 JSON 格式汇总 ECharts 的历史数据',
						},
					},
					native: {},
				});
			}
			// sum JSON-Objekt für Stunden-Vorhersage erstellen, falls aktiviert und mehr als 1 Standort
			if (this.adapter.config.locationsTotal_hourly_json && this.adapter.config.pv_locations.length > 1) {
				const sumBase = 'pv-forecast';
				await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_hourly-json_chart`, {
					type: 'state',
					common: {
						name: {
							en: 'Sum JSON Chart Data Hourly',
							de: 'Summe JSON Diagramm Daten Stündlich',
							ru: 'Суммарные данные JSON за час',
							pt: 'Sum JSON Dados do Gráfico Horário',
							nl: 'Sum JSON Grafiekgegevens Uurlijk',
							fr: 'Sum JSON Données du graphique Horaire',
							it: 'Sum JSON Grafico Dati Orari',
							es: 'Sum JSON Datos de carga Horaria',
							pl: 'Sum JSON Wykres Dane Godzinowe',
							uk: 'Сума JSON Графік даних Щогодини',
							'zh-cn': 'JSON总和 图表 每小时',
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						desc: {
							en: 'Sum History data for eCharts in JSON format',
							de: 'Summe für eCharts im JSON-Format',
							ru: 'Данные истории сумм для электронных диаграммы в формате JSON',
							pt: 'Dados do Sum History para eCharts em JSON',
							nl: 'Som geschiedenisgegevens voor eCharts in JSON-formaat',
							fr: 'Historique des sommes pour eCharts au format JSON',
							it: 'Sum History per eCharts in formato JSON',
							es: 'Sumar datos históricos de ECharts en formato JSON',
							pl: 'Suma danych historii dla eCharts w formacie JSON',
							uk: 'Сума даних історії для eCharts у форматі JSON',
							'zh-cn': '以 JSON 格式汇总 ECharts 的历史数据',
						},
					},
					native: {},
				});
			}
		}

		//minütlich Summe aller Standorte
		if (
			this.adapter.config.minutes_15 &&
			this.adapter.config.locationsTotal_minutely &&
			this.adapter.config.pv_locations.length > 1
		) {
			const sumBase = 'pv-forecast';
			await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_15_Minutely`, {
				type: 'channel',
				common: {
					name: {
						en: 'Sum Peak from Locations 15 Minutely',
						de: 'Summe der Spitzenwerte von Standorten alle 15 Minuten',
						ru: 'Суммарный пиковый расход электроэнергии в различных местах составляет 15 минут.',
						pt: 'Soma dos picos a partir de locais a cada 15 minutos',
						nl: 'Som van pieken vanaf locaties elke 15 minuten',
						fr: 'Somme des pics à partir des emplacements toutes les 15 minutes',
						it: 'Somma dei picchi dalle località ogni 15 minuti',
						es: 'Suma de picos desde ubicaciones cada 15 minutos',
						pl: 'Sum Peak z lokalizacji 15 minut',
						uk: 'Сума піку з місць розташування кожні 15 хвилин',
						'zh-cn': '从指定地点出发，15分钟即可到达萨姆峰',
					},
				},
				native: {},
			});

			for (let i = 0; i < 96; i++) {
				const channelId = `${sumBase}.sum_peak_locations_15_Minutely.${i}`;

				await this.adapter.setObjectNotExistsAsync(channelId, {
					type: 'channel',
					common: { name: `Interval ${i}` },
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(
					`${sumBase}.sum_peak_locations_15_Minutely.${i}.sum_locations`,
					{
						type: 'state',
						common: {
							name: {
								en: '15 Minutes Sum of all locations',
								de: '15 Minuten Summe aller Standorte',
								ru: '15 минут Сумма всех мест',
								pt: '15 minutos Soma de todos os locais',
								nl: '15 Minuten Som van alle locaties',
								fr: '15 minutes Somme de tous les lieux',
								it: '15 minuti Somma di tutti i luoghi',
								es: '15 Minutos Suma de todas las localizaciones',
								pl: '15 minut Suma wszystkich lokalizacji',
								uk: '15 хвилин Сума всіх локацій',
								'zh-cn': '15 Minutes Sum of all locations',
							},
							type: 'number',
							role: 'value.energy',
							unit: 'Wh',
							read: true,
							write: false,
						},
						native: {},
					},
				);

				await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_15_Minutely.${i}.time`, {
					type: 'state',
					common: {
						name: {
							en: 'Time',
							de: 'Zeit',
							ru: 'Время',
							pt: 'Tempo',
							nl: 'Tijd',
							fr: "L'heure",
							it: 'Tempo',
							es: 'Tiempo',
							pl: 'Czas',
							uk: 'Час',
							'zh-cn': 'Time',
						},
						type: 'string',
						role: 'date',
						read: true,
						write: false,
					},
					native: {},
				});
			}
		}
		//stündliche Summe aller Standorte
		if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length > 1) {
			const sumBase = 'pv-forecast';
			await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Hourly`, {
				type: 'channel',
				common: {
					name: {
						en: 'Sum Peak from Locations Hourly',
						de: 'Summe der Spitzenwerte von Standorten stündlich',
						ru: 'Суммарный пиковый уровень в зависимости от местоположения (почасовая шкала)',
						pt: 'Soma dos picos de localização por hora',
						nl: 'Som van pieken van locaties per uur',
						fr: 'Somme maximale des emplacements horaires',
						it: 'Somma di picco dalle posizioni orarie',
						es: 'Suma de picos desde ubicaciones por hora',
						pl: 'Suma szczytów z lokalizacji godzinowych',
						uk: 'Сума піку з місць розташування щогодини',
						'zh-cn': '从各个地点每小时计算的总峰值',
					},
				},
				native: {},
			});

			for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
				await this.adapter.setObjectNotExistsAsync(`${sumBase}.sum_peak_locations_Hourly.Hour${hour}`, {
					type: 'channel',
					common: {
						name: {
							en: `Hour ${hour}`,
							de: `Stunde ${hour}`,
							ru: `Час ${hour}`,
							pt: `Hora ${hour}`,
							nl: `Uur ${hour}`,
							fr: `Heure ${hour}`,
							it: `Ora ${hour}`,
							es: `Hora ${hour}`,
							pl: `Godzina ${hour}`,
							uk: `Година ${hour}`,
							'zh-cn': `小时 ${hour}`,
						},
					},
					native: {},
				});

				await this.adapter.setObjectNotExistsAsync(
					`${sumBase}.sum_peak_locations_Hourly.Hour${hour}.sum_locations`,
					{
						type: 'state',
						common: {
							name: {
								en: 'Hourly Sum of all locations',
								de: 'Stündliche Summe aller Standorte',
								ru: 'Почасовая сумма по всем местоположениям',
								pt: 'Soma horária de todos os locais',
								nl: 'Uurtotaal van alle locaties',
								fr: 'Somme horaire de tous les emplacements',
								it: 'Somma oraria di tutte le posizioni',
								es: 'Suma horaria de todas las ubicaciones',
								pl: 'Suma godzinowa wszystkich lokalizacji',
								uk: 'Погодинна сума всіх локацій',
								'zh-cn': '所有地点每小时总和',
							},
							type: 'number',
							role: 'value.energy',
							unit: 'Wh',
							read: true,
							write: false,
						},
						native: {},
					},
				);

				await this.adapter.setObjectNotExistsAsync(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.time`, {
					type: 'state',
					common: {
						name: {
							en: 'Hour Time',
							de: 'Stundenzeit',
							ru: 'Час Время',
							pt: 'Hora',
							nl: 'Uur Tijd',
							fr: 'Heure',
							it: 'Ora Ora',
							es: 'Hora Tiempo',
							pl: 'Godzina Czas',
							uk: 'Година Час',
							'zh-cn': '小时',
						},
						type: 'string',
						role: 'date',
						read: true,
						write: false,
					},
					native: {},
				});
			}
		}
	}

	private async updateAllLocations(): Promise<void> {
		for (const location of this.adapter.config.pv_locations) {
			try {
				const locationName = this.sanitizeLocationName(location.name);
				const base = `pv-forecast.${locationName}`;

				await this.updateLocation(location, base);
			} catch (error) {
				this.adapter.log.error(`Error updating PV location ${location.name}: ${(error as Error).message}`);
			}
		}
		await this.updateSumLocations();

		const now = new Date();
		const day = String(now.getDate()).padStart(2, '0');
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const year = now.getFullYear();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const timestamp = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
		await this.adapter.setState('info.lastUpdate_PV_Forecast', { val: timestamp, ack: true });
	}

	private async updateSumLocations(): Promise<void> {
		// Summe Täglich
		if (this.adapter.config.locationsTotal && this.adapter.config.pv_locations.length >= 1) {
			for (let day = 0; day < this.adapter.config.forecastDays; day++) {
				let sum = 0;
				for (const location of this.adapter.config.pv_locations) {
					const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
					const state = await this.adapter.getStateAsync(`${base}.daily-forecast.day${day}.Peak_day`);
					if (state && state.val !== null && state.val !== undefined) {
						sum += state.val as number;
					}
				}
				await this.adapter.setState(`pv-forecast.sum_peak_locations_Daily.day${day}.sum_locations`, {
					val: sum,
					ack: true,
				});
			}
		}
		// Summe Stündlich
		if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length >= 1) {
			for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
				let sum = 0;
				for (const location of this.adapter.config.pv_locations) {
					const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
					const state = await this.adapter.getStateAsync(
						`${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`,
					);
					if (state && state.val !== null && state.val !== undefined) {
						sum += state.val as number;
					}
				}
				await this.adapter.setState(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.sum_locations`, {
					val: sum,
					ack: true,
				});
			}
		}
		// --- Summe 15 Minuten ---
		if (
			this.adapter.config.minutes_15 &&
			this.adapter.config.locationsTotal_minutely &&
			this.adapter.config.pv_locations.length > 1
		) {
			this.adapter.log.debug('Starting 15-min sum calculation...');

			for (let i = 0; i < 96; i++) {
				let totalSum = 0;
				let timeVal = '';
				let foundAnyValue = false;

				for (const location of this.adapter.config.pv_locations) {
					const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;
					const stateId = `${base}.15-min-forecast.${i}.global_tilted_irradiance`;
					const timeId = `${base}.15-min-forecast.${i}.time`;

					const locState = await this.adapter.getStateAsync(stateId);
					const locTime = await this.adapter.getStateAsync(timeId);

					if (locState && locState.val !== null && locState.val !== undefined) {
						totalSum += Number(locState.val);
						foundAnyValue = true;
					}
					if (locTime && locTime.val) {
						timeVal = String(locTime.val);
					}
				}

				if (foundAnyValue) {
					await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.sum_locations`, {
						val: totalSum,
						ack: true,
					});
				}

				if (timeVal) {
					await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.time`, {
						val: timeVal,
						ack: true,
					});
				}
			}
		}
	}

	private async updateLocation(location: any, base: string): Promise<void> {
		const effectiveLocation = { ...location };
		const latMissing =
			effectiveLocation.pv_latitude === undefined ||
			effectiveLocation.pv_latitude === null ||
			(effectiveLocation.pv_latitude as unknown as string) === '';
		const lonMissing =
			effectiveLocation.pv_longitude === undefined ||
			effectiveLocation.pv_longitude === null ||
			(effectiveLocation.longitude as unknown as string) === '';

		if (latMissing || lonMissing) {
			this.adapter.log.debug(
				`[${location.name}] Debug:longitude and/or latitude not set, loading system configuration`,
			);

			const sysConfig = await this.adapter.getForeignObjectAsync('system.config');
			const sysLat = sysConfig?.common?.latitude;
			const sysLon = sysConfig?.common?.longitude;

			if (sysLat !== undefined && sysLat !== null && sysLon !== undefined && sysLon !== null) {
				effectiveLocation.pv_latitude = sysLat;
				effectiveLocation.pv_longitude = sysLon;
				this.adapter.log.info(
					`[${location.name}] using system latitude: ${effectiveLocation.pv_latitude}, system longitude: ${effectiveLocation.pv_longitude}`,
				);
			} else {
				this.adapter.log.error(
					`[${location.name}] latitude and/or longitude not set and no system coordinates available. Skipping location.`,
				);
				return;
			}
		}

		try {
			const data = await this.apiCaller.fetchForecastData(effectiveLocation, this.adapter.config.forecastDays);

			if (!data || !data.hourly || !data.hourly.time) {
				this.adapter.log.error(`[${location.name}] The API returned no data..`);
				return;
			}

			// kwp sicher als Zahl interpretieren
			let kwpRaw = location.kwp;
			if (typeof kwpRaw === 'string') {
				kwpRaw = kwpRaw.replace(',', '.');
			}
			const kwpFactor = parseFloat(kwpRaw) || 0;

			const dailySums: Record<string, number> = {};

			// 1. Alle Stunden summieren
			for (let i = 0; i < data.hourly.time.length; i++) {
				const timeStr = data.hourly.time[i];
				const rawIrradiance = data.hourly.global_tilted_irradiance[i];

				if (timeStr && rawIrradiance !== undefined) {
					const dateKey = timeStr.split('T')[0];
					if (!dailySums[dateKey]) {
						dailySums[dateKey] = 0;
					}
					dailySums[dateKey] += rawIrradiance * kwpFactor;
				}
			}

			// 2. Daily States schreiben
			const todayObj = new Date();
			todayObj.setHours(12, 0, 0, 0);

			const sysLang = this.adapter.language || 'de';

			for (let day = 0; day < this.adapter.config.forecastDays; day++) {
				const targetDate = new Date(todayObj);
				targetDate.setDate(todayObj.getDate() + day);

				const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
				const totalWh = Math.round(dailySums[dateKey] || 0);

				const formattedDisplayDate = targetDate.toLocaleDateString(sysLang, {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
				});

				await this.adapter.setState(`${base}.daily-forecast.day${day}.Date`, {
					val: formattedDisplayDate,
					ack: true,
				});

				await this.adapter.setState(`${base}.daily-forecast.day${day}.Peak_day`, {
					val: totalWh,
					ack: true,
				});
			}

			// 3. Stündliche Rolling-Werte (für die Anzeige "was kommt als nächstes")
			const now = new Date();
			let startSearchTime: number;

			if (this.adapter.config.hourlyUpdate === 1) {
				// FESTE STUNDEN: Start bei heute 0:00 Uhr
				startSearchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
			} else {
				// ROLLENDE STUNDEN: Start bei aktueller Stunde (Original-Code)
				startSearchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
			}

			let currentHourIndex = data.hourly.time.findIndex((t: string) => new Date(t).getTime() >= startSearchTime);

			if (currentHourIndex === -1) {
				currentHourIndex = 0;
			}

			for (let hour = 0; hour < this.adapter.config.pv_forecastHours; hour++) {
				const idx = currentHourIndex + hour;
				if (idx < data.hourly.time.length) {
					const apiDate = new Date(data.hourly.time[idx]);
					const formattedTime = apiDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
					const unixTimestamp = apiDate.getTime();
					const powerW = Math.round(data.hourly.global_tilted_irradiance[idx] * kwpFactor);
					const sunshineMinutes = Math.round((data.hourly.sunshine_duration[idx] || 0) / 60);

					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.time`, {
						val: formattedTime,
						ack: true,
					});

					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.unix_time_stamp`, {
						val: unixTimestamp,
						ack: true,
					});

					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.global_tilted_irradiance`, {
						val: powerW,
						ack: true,
					});
					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.temperature_2m`, {
						val: data.hourly.temperature_2m[idx],
						ack: true,
					});
					if (this.adapter.config.cloud_cover) {
						await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.cloud_cover`, {
							val: data.hourly.cloud_cover[idx],
							ack: true,
						});
					}
					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.wind_speed_10m`, {
						val: data.hourly.wind_speed_10m[idx],
						ack: true,
					});
					if (this.adapter.config.sunhine_duration) {
						await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.sunshine_duration`, {
							val: sunshineMinutes,
							ack: true,
						});
					}
					// Platten Temperatur berechnen
					const ambientTemp = data.hourly.temperature_2m[idx];
					const irradiance = data.hourly.global_tilted_irradiance[idx];
					const windSpeedKmH = data.hourly.wind_speed_10m[idx] || 0;
					const windSpeedMS = windSpeedKmH / 3.6;

					const pvTemp = Math.round((ambientTemp + irradiance / (25 + 6.84 * windSpeedMS)) * 10) / 10;

					await this.adapter.setState(`${base}.hourly-forecast.hour${hour}.pv_temperature`, {
						val: pvTemp,
						ack: true,
					});

					if (this.adapter.config.locationsTotal_hourly && this.adapter.config.pv_locations.length > 1) {
						await this.adapter.setState(`pv-forecast.sum_peak_locations_Hourly.Hour${hour}.time`, {
							val: formattedTime,
							ack: true,
						});
					}
				}
			}
			// --- 15-MINUTEN VORHERSAGE BEFÜLLEN ---
			if (this.adapter.config.minutes_15 && (data as any).minutely_15) {
				this.adapter.log.debug(`[${location.name}] Fill in the 15-minute forecast...`);

				const minData = (data as any).minutely_15;
				let unixTimestamp = 0;

				for (let i = 0; i < 96; i++) {
					if (minData.time[i]) {
						const apiDate = new Date(minData.time[i]);
						unixTimestamp = apiDate.getTime();
						const formattedTime = apiDate.toLocaleTimeString('de-DE', {
							hour: '2-digit',
							minute: '2-digit',
						});
						const path = `${base}.15-min-forecast.${i}`;

						// Werte schreiben
						await this.adapter.setState(`${path}.time`, { val: formattedTime, ack: true });
						await this.adapter.setState(`${path}.unix_time_stamp`, { val: unixTimestamp, ack: true });

						if (
							this.adapter.config.locationsTotal_minutely &&
							this.adapter.config.pv_locations.length > 1
						) {
							await this.adapter.setState(`pv-forecast.sum_peak_locations_15_Minutely.${i}.time`, {
								val: formattedTime,
								ack: true,
							});
						}

						if (minData.global_tilted_irradiance) {
							await this.adapter.setState(`${path}.global_tilted_irradiance`, {
								val: Math.round(minData.global_tilted_irradiance[i] * kwpFactor),
								ack: true,
							});
						}
						if (minData.temperature_2m) {
							await this.adapter.setState(`${path}.temperature_2m`, {
								val: minData.temperature_2m[i],
								ack: true,
							});
						}
						if (minData.wind_speed_10m) {
							await this.adapter.setState(`${path}.wind_speed_10m`, {
								val: minData.wind_speed_10m[i],
								ack: true,
							});
						}
						if (this.adapter.config.sunshine_duration) {
							if (minData.sunshine_duration) {
								const sunMin = Math.round((minData.sunshine_duration[i] || 0) / 60);
								await this.adapter.setState(`${path}.sunshine_duration`, {
									val: sunMin,
									ack: true,
								});
							}
						}
						if (minData.temperature_2m !== undefined && minData.global_tilted_irradiance !== undefined) {
							const ambientTemp = minData.temperature_2m[i];
							const irradiance = minData.global_tilted_irradiance[i];
							const windSpeedKmH = minData.wind_speed_10m ? minData.wind_speed_10m[i] : 0;
							const windSpeedMS = windSpeedKmH / 3.6;

							// Faiman-Modell: T_module = T_ambient + Irradiance / (U0 + U1 * Windspeed)
							// Werte 25 (U0) und 6.84 (U1) sind Standard für Aufdach-Montage
							const pvTemp = Math.round((ambientTemp + irradiance / (25 + 6.84 * windSpeedMS)) * 10) / 10;

							await this.adapter.setState(`${path}.pv_temperature`, {
								val: pvTemp,
								ack: true,
							});
						}
					}
				}
			}
			// --- Neuer Block für das JSON-Chart nach dem Einzelpunkte-Block ---
			if (this.adapter.config.minutes_15_json && (data as any).minutely_15) {
				this.adapter.log.debug(`[${location.name}] Generating 15-minute JSON chart...`);

				const minData = (data as any).minutely_15;
				const chartData = [];

				for (let i = 0; i < 96; i++) {
					if (minData.time[i]) {
						const apiDate = new Date(minData.time[i]);
						const unixTimestamp = apiDate.getTime();

						const irradianceValue = minData.global_tilted_irradiance
							? Math.round(minData.global_tilted_irradiance[i] * kwpFactor)
							: 0;

						// Datenpunkt für das Array hinzufügen
						chartData.push({
							ts: unixTimestamp,
							val: irradianceValue,
						});
					}
				}

				// Den fertigen JSON-String in den State schreiben
				await this.adapter.setState(`${base}.15-min-json_chart`, {
					val: JSON.stringify(chartData),
					ack: true,
				});
			}
			// --- Neuer Stunden Block für das JSON-Chart nach dem Einzelpunkte-Block ---
			if (this.adapter.config.hours_json && (data as any).hourly) {
				this.adapter.log.debug(`[${location.name}] Generating hourly JSON chart...`);

				const hourlyData = (data as any).hourly;
				const chartData = [];
				const forecastHours = this.adapter.config.pv_forecastHours || 24;

				for (let i = 0; i < forecastHours; i++) {
					if (hourlyData.time[i]) {
						const apiDate = new Date(hourlyData.time[i]);
						const unixTimestamp = apiDate.getTime();

						const irradianceValue = hourlyData.global_tilted_irradiance
							? Math.round(hourlyData.global_tilted_irradiance[i] * kwpFactor)
							: 0;

						// Datenpunkt für das Array hinzufügen
						chartData.push({
							ts: unixTimestamp,
							val: irradianceValue,
						});
					}
				}

				// Den fertigen JSON-String in den State schreiben
				await this.adapter.setState(`${base}.hourly-json_chart`, {
					val: JSON.stringify(chartData),
					ack: true,
				});
			}

			//summe aller Standorte im 15-Minuten-Intervall als JSON für eCharts
			if (
				this.adapter.config.locationsTotal_minutely_json &&
				this.adapter.config.minutes_15 &&
				this.adapter.config.pv_locations.length > 1
			) {
				const sumChartData = [];

				for (let i = 0; i < 96; i++) {
					let totalSum = 0;
					let currentTimeStr = '';

					for (const location of this.adapter.config.pv_locations) {
						const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;

						const locTimeState = await this.adapter.getStateAsync(
							`${base}.15-min-forecast.${i}.unix_time_stamp`,
						);
						const locValState = await this.adapter.getStateAsync(
							`${base}.15-min-forecast.${i}.global_tilted_irradiance`,
						);

						if (locValState && locValState.val !== null) {
							totalSum += locValState.val as number;
						}
						if (locTimeState && locTimeState.val) {
							currentTimeStr = String(locTimeState.val);
						}
					}

					// Nur hinzufügen, wenn Uhrzeit gefunden
					if (currentTimeStr) {
						sumChartData.push({
							ts: currentTimeStr,
							val: totalSum,
						});
					}
				}

				// Das fertige JSON schreiben
				if (sumChartData.length > 0) {
					await this.adapter.setState(`pv-forecast.sum_peak_15-min-json_chart`, {
						val: JSON.stringify(sumChartData),
						ack: true,
					});
					this.adapter.log.debug(`15-min Sum-JSON created.`);
				}
			}
			//summe aller Standorte Stunden als JSON für eCharts
			if (
				this.adapter.config.locationsTotal_minutely_json &&
				this.adapter.config.minutes_15 &&
				this.adapter.config.pv_locations.length > 1
			) {
				const sumChartData = [];
				const forecastHours = this.adapter.config.pv_forecastHours || 24;

				for (let i = 0; i < forecastHours; i++) {
					let totalSum = 0;
					let currentTimeStr = '';

					for (const location of this.adapter.config.pv_locations) {
						const base = `pv-forecast.${this.sanitizeLocationName(location.name)}`;

						// Wir holen uns die Werte der einzelnen Locations aus deren States
						const locTimeState = await this.adapter.getStateAsync(
							`${base}.hourly-forecast.hour${i}.unix_time_stamp`,
						);
						const locValState = await this.adapter.getStateAsync(
							`${base}.hourly-forecast.hour${i}.global_tilted_irradiance`,
						);

						if (locValState && locValState.val !== null) {
							totalSum += locValState.val as number;
						}
						if (locTimeState && locTimeState.val) {
							currentTimeStr = String(locTimeState.val);
						}
					}

					// Nur hinzufügen, wenn Uhrzeit gefunden
					if (currentTimeStr) {
						sumChartData.push({
							ts: currentTimeStr,
							val: totalSum,
						});
					}
				}

				// Das fertige JSON schreiben
				if (sumChartData.length > 0) {
					await this.adapter.setState(`pv-forecast.sum_peak_hourly-json_chart`, {
						val: JSON.stringify(sumChartData),
						ack: true,
					});
					this.adapter.log.debug(`Hourly Sum-JSON created.`);
				}
			}

			this.adapter.log.info(
				`[${location.name}] Update successful. Day0: ${Math.round(dailySums[Object.keys(dailySums)[0]] || 0)} Wh`,
			);
		} catch (error) {
			this.adapter.log.error(`[${location.name}] Error: ${(error as Error).message}`);
		}
	}

	private sanitizeLocationName(name: string): string {
		return name
			.replace(/[^a-zA-Z0-9_-]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '');
	}

	/**
	 * Clears the active update interval.
	 */
	public destroy(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null; // Hier null statt undefined
			this.adapter.log.debug('PV-Service interval cleared.');
		}

		if (this.astroTimeout) {
			clearTimeout(this.astroTimeout);
			this.astroTimeout = null;
			this.adapter.log.debug('PV-Service astro timer cleared.');
		}
	}
}
