import { browserConnector } from "./browser";
import { computerUseConnector } from "./computer-use";
import { gmailConnector } from "./gmail";
import { gmailFullConnector } from "./gmail-full";
import { slackConnector } from "./slack";
import { twitterConnector } from "./twitter";
import { linkedinConnector } from "./linkedin";
import { instagramConnector } from "./instagram";
import { telegramConnector } from "./telegram";
import { whatsappConnector } from "./whatsapp";
import type { ConnectorId } from "./types";

export const connectors = {
  browser: browserConnector,
  gmail: gmailConnector,
  gmail_full: gmailFullConnector,
  slack: slackConnector,
  computer_use: computerUseConnector,
  twitter: twitterConnector,
  linkedin: linkedinConnector,
  instagram: instagramConnector,
  telegram: telegramConnector,
  whatsapp: whatsappConnector,
} as const;

export function getConnector<K extends ConnectorId>(id: K): (typeof connectors)[K] {
  return connectors[id];
}
