// This file extends the AdapterConfig type from "@iobroker/adapter-core"
// It tells TypeScript which properties exist in the io-package.json native section

export {};

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            locations: {
                name: string;
                lat: number;
                lon: number;
                tz: string;
                country?: string;
            }[];
            isNight_icon: boolean;
            isWinddirection_icon: boolean;
            pollenEnabled: boolean;
            airQualityEnabled: boolean;
            language: string;
            forecastDays: number;
        }
    }
}