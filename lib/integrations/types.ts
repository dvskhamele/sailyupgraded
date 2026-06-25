import type { IntegrationProvider } from "@prisma/client";

export type TwilioSettings = {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
};

export type ResendSettings = {
  apiKey: string;
  emailFrom: string;
};

export type RetellSettings = {
  apiKey: string;
  publicKey: string;
  phoneNumber: string;
  webhookUrl: string;
};

export type R2Settings = {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  publicUrl: string;
};

export type Smtp2goSettings = {
  apiKey: string;
};

export type IntegrationSettings =
  | TwilioSettings
  | ResendSettings
  | RetellSettings
  | R2Settings
  | Smtp2goSettings;

export type ProviderSettingsMap = {
  [IntegrationProvider.TWILIO]: TwilioSettings;
  [IntegrationProvider.RESEND]: ResendSettings;
  [IntegrationProvider.RETELL]: RetellSettings;
  [IntegrationProvider.R2]: R2Settings;
  [IntegrationProvider.SMTP2GO]: Smtp2goSettings;
};

export type MaskedIntegrationSettings = {
  [IntegrationProvider.TWILIO]?: Omit<TwilioSettings, "authToken"> & {
    authToken: string;
  };
  [IntegrationProvider.RESEND]?: Omit<ResendSettings, "apiKey"> & {
    apiKey: string;
  };
  [IntegrationProvider.RETELL]?: Omit<RetellSettings, "apiKey"> & {
    apiKey: string;
  };
  [IntegrationProvider.R2]?: Omit<R2Settings, "secretKey"> & {
    secretKey: string;
  };
  [IntegrationProvider.SMTP2GO]?: Omit<Smtp2goSettings, "apiKey"> & {
    apiKey: string;
  };
};
