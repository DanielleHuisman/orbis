import {OrbisModule} from '@orbis-framework/core';

export interface Email {
    to: string;
    cc?: string[];
    bcc?: string[];
    // TODO: email templates for subject/body?
}

export abstract class OrbisEmail extends OrbisModule<void> {

    getProvidedNames() {
        return ['email'];
    }

    abstract send(email: Email): Promise<void>;
}
