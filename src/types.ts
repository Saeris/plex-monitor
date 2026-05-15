export interface TextDisplayComponent {
  type: 10;
  content: string;
}

export interface ThumbnailComponent {
  type: 11;
  media: { url: string };
  description?: string;
  spoiler?: boolean;
}

export interface SectionComponent {
  type: 9;
  components: TextDisplayComponent[];
  accessory: ThumbnailComponent;
}

export interface DiscordWebhookPayload {
  flags?: number;
  content?: string;
  components?: SectionComponent[];
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}
