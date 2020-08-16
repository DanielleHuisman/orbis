import {Orbis} from './orbis';

export abstract class OrbisModule<Options> {

    private options: Options;

    constructor(options: Options) {
        this.options = {
            ...options
        };
    }

    getOptions() {
        return this.options;
    }

    getOption<T extends keyof Options>(name: T, defaultValue?: Options[T]) {
        return this.options[name] === undefined ? defaultValue : this.options[name];
    }

    updateOptions(options: Partial<Options>) {
        this.options = {
            ...this.options,
            ...options
        };
    }

    abstract getName(): string;

    abstract getProvidedNames(): string[];

    abstract getOrbis(): Orbis;
}
