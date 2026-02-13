/**
 * Type definitions for Plex webhook payloads
 */

export interface PlexWebhookPayload {
  event: string;
  user: boolean;
  owner: boolean;
  Account: {
    id: number;
    thumb: string;
    title: string;
  };
  Server: {
    title: string;
    uuid: string;
  };
  Player?: {
    local: boolean;
    publicAddress: string;
    title: string;
    uuid: string;
  };
  Metadata: PlexMetadata;
}

export interface PlexMetadata {
  librarySectionType: string;
  ratingKey: string;
  key: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  guid: string;
  parentGuid?: string;
  grandparentGuid?: string;
  type: "show" | "season" | "episode" | "movie";
  title: string;
  titleSort?: string;
  grandparentKey?: string;
  parentKey?: string;
  librarySectionTitle: string;
  librarySectionID: number;
  librarySectionKey: string;
  contentRating?: string;
  summary?: string;
  index?: number; // Season number or episode number
  parentIndex?: number; // Season number for episodes
  parentTitle?: string; // Season title
  grandparentTitle?: string; // Show title for seasons/episodes
  thumb?: string;
  art?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  grandparentArt?: string;
  addedAt: number;
  updatedAt: number;
  // Movie-specific fields
  year?: number;
  duration?: number; // In milliseconds
  originallyAvailableAt?: string; // Date string
  studio?: string;
  rating?: number;
  tagline?: string;
  // Directors, genres, etc.
  Director?: Array<{ tag: string }>;
  Genre?: Array<{ tag: string }>;
  // Series-specific
  childCount?: number; // Number of seasons or episodes
  leafCount?: number; // Total episode count
}

export interface ParsedWebhookData {
  event: string;
  serverName: string;
  metadata: {
    type: "show" | "season" | "movie";
    title: string;
    seriesTitle?: string; // For seasons
    seasonNumber?: number;
    summary?: string;
    libraryName: string;
    thumb?: string;
    addedAt: number;
    // Movie-specific
    year?: number;
    runtime?: number; // In minutes
    director?: string;
    genres?: string[];
    // Series-specific
    seasonCount?: number;
    episodeCount?: number;
  };
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
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  fields?: DiscordEmbedField[];
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}
