import {OrbisModule} from '@orbis-framework/core';
import {Transporter} from 'nodemailer';
import EmailTemplates, {EmailConfig} from 'email-templates';

export interface OrbisEmailOptions {
    transport: Transporter;
    templates: Omit<EmailConfig, 'message' | 'transport'> & {
        message?: EmailConfig['message'];
    };
    changeTemplate?: <T extends Record<string, unknown>>(template: string, locals: T) => string;
}

export type Email<T> = EmailTemplates.EmailOptions<T>;

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

    async send<T extends Record<string, unknown>>(email: EmailTemplates.EmailOptions<T>) {
        const changeTemplate = this.getOption('changeTemplate');
        const template = email.template && changeTemplate ? changeTemplate(email.template, email.locals) : email.template;

        return await this.templates.send({
            ...email,
            template
        });
    }
}
