import {Orbis} from '@orbis-framework/core';
import {OrbisEmail, Email} from '@orbis-framework/email';

export const sendEmail = <T extends Record<string, unknown>>(orbis: Orbis, email: Email<T>) => {
    // Find Orbis Email module for email integration
    const orbisEmail = orbis.getModule<OrbisEmail>('email');

    // Send email if available
    if (email) {
        return orbisEmail.send(email);
    }
    return Promise.resolve();
};
