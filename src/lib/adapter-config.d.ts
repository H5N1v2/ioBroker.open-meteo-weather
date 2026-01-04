// This file extends the AdapterConfig type from "@iobroker/adapter-core"
// It tells TypeScript which properties exist in the io-package.json native section

export {};

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            latitude: number;
            longitude: number;
            interval: number;
            pollenEnabled: boolean;
            airQualityEnabled: boolean;
            language: string;
        }
    }
}