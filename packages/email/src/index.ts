import {OrbisModule} from '@orbis-framework/core';
import EmailTemplates, {EmailConfig} from 'email-templates';

export interface Email {
    to: string;
    cc?: string[];
    bcc?: string[];
    // TODO: email templates for subject/body?
}

export interface OrbisEmailOptions {
    templates: EmailConfig;
}

// TODO: consider just using nodemailer, which has an API for different transports

export abstract class OrbisEmail<Options extends OrbisEmailOptions> extends OrbisModule<Options> {

    templates: EmailTemplates;

    constructor(options: Options) {
        super(options);

        this.templates = new EmailTemplates(options.templates);
    }

    getProvidedNames() {
        return ['email'];
    }

    async send(email: Email) {
        const message = await this.templates.renderAll();

        await this.sendEmail();
    }

    // TODO:
    abstract sendEmail(email: any): Promise<void>;
}
