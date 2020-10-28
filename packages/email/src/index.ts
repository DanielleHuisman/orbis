import {OrbisModule} from '@orbis-framework/core';
import {Transporter} from 'nodemailer';
import EmailTemplates, {EmailConfig} from 'email-templates';

export interface OrbisEmailOptions {
    transport: Transporter;
    templates: Omit<EmailConfig, 'message' | 'transport'> & {
        message?: EmailConfig['message'];
    };
}

export class OrbisEmail extends OrbisModule<OrbisEmailOptions> {

    transport: Transporter;
    templates: EmailTemplates;

    constructor(options: OrbisEmailOptions) {
        super(options);

        this.transport = options.transport;
        this.templates = new EmailTemplates({
            ...options.templates,
            message: options.templates.message || {},
            transport: options.transport
        });
    }

    getName() {
        return 'email';
    }

    getProvidedNames() {
        return [];
    }

    getOrbis() {
        return null;
    }

    getTypes() {
        return {};
    }

    getTransport() {
        return this.transport;
    }

    getTemplates() {
        return this.templates;
    }

    async send<T>(email: EmailTemplates.EmailOptions<T>) {
        return await this.templates.send(email);
    }
}
