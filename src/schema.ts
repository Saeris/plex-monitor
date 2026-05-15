import * as v from "valibot";

/**
 * Valibot schemas for TMDB API responses
 *
 * Based on official TMDB API documentation:
 * - Movie Details: https://developer.themoviedb.org/reference/movie-details
 * - TV Series Details: https://developer.themoviedb.org/reference/tv-series-details
 * - TV Season Details: https://developer.themoviedb.org/reference/tv-season-details
 */

// Common schemas used across multiple endpoints

const GenreSchema = v.object({
  id: v.number(),
  name: v.string()
});

const ProductionCompanySchema = v.looseObject({
  id: v.number(),
  logo_path: v.nullable(v.string()),
  name: v.string(),
  origin_country: v.string()
});

const ProductionCountrySchema = v.object({
  iso_3166_1: v.string(),
  name: v.string()
});

const SpokenLanguageSchema = v.object({
  english_name: v.string(),
  iso_639_1: v.string(),
  name: v.string()
});

const CollectionSchema = v.looseObject({
  id: v.number(),
  name: v.string(),
  poster_path: v.nullable(v.string()),
  backdrop_path: v.nullable(v.string())
});

// ============================================================================
// MOVIE DETAILS
// ============================================================================

const CastMemberSchema = v.looseObject({
  id: v.number(),
  name: v.string(),
  character: v.string(),
  order: v.number()
});

const CrewMemberSchema = v.looseObject({
  id: v.number(),
  name: v.string(),
  job: v.string(),
  department: v.string()
});

const CreditsSchema = v.looseObject({
  cast: v.array(CastMemberSchema),
  crew: v.array(CrewMemberSchema)
});

const VideoSchema = v.looseObject({
  id: v.string(),
  key: v.string(),
  name: v.string(),
  site: v.string(),
  type: v.string(),
  official: v.boolean()
});

const VideosSchema = v.looseObject({
  results: v.array(VideoSchema)
});

export const TMDBMovieDetailsSchema = v.looseObject({
  adult: v.boolean(),
  backdrop_path: v.nullable(v.string()),
  belongs_to_collection: v.nullable(CollectionSchema),
  budget: v.number(),
  genres: v.array(GenreSchema),
  homepage: v.nullable(v.string()),
  id: v.number(),
  imdb_id: v.nullable(v.string()),
  origin_country: v.array(v.string()),
  original_language: v.string(),
  original_title: v.string(),
  overview: v.nullable(v.string()),
  popularity: v.number(),
  poster_path: v.nullable(v.string()),
  production_companies: v.array(ProductionCompanySchema),
  production_countries: v.array(ProductionCountrySchema),
  release_date: v.string(),
  revenue: v.number(),
  runtime: v.nullable(v.number()),
  spoken_languages: v.array(SpokenLanguageSchema),
  status: v.string(),
  tagline: v.nullable(v.string()),
  title: v.string(),
  video: v.boolean(),
  vote_average: v.number(),
  vote_count: v.number(),
  credits: v.optional(CreditsSchema),
  videos: v.optional(VideosSchema)
});

export type TMDBMovieDetails = v.InferOutput<typeof TMDBMovieDetailsSchema>;

// ============================================================================
// TV SERIES DETAILS
// ============================================================================

const CreatedBySchema = v.looseObject({
  id: v.number(),
  credit_id: v.string(),
  name: v.string(),
  original_name: v.string(),
  gender: v.number(),
  profile_path: v.nullable(v.string())
});

const NetworkSchema = v.looseObject({
  id: v.number(),
  logo_path: v.nullable(v.string()),
  name: v.string(),
  origin_country: v.string()
});

const SeasonSchema = v.looseObject({
  air_date: v.nullable(v.string()),
  episode_count: v.number(),
  id: v.number(),
  name: v.string(),
  overview: v.string(),
  poster_path: v.nullable(v.string()),
  season_number: v.number(),
  vote_average: v.number()
});

const LastEpisodeSchema = v.looseObject({
  id: v.number(),
  name: v.string(),
  overview: v.string(),
  vote_average: v.number(),
  vote_count: v.number(),
  air_date: v.string(),
  episode_number: v.number(),
  episode_type: v.string(),
  production_code: v.string(),
  runtime: v.nullable(v.number()),
  season_number: v.number(),
  show_id: v.number(),
  still_path: v.nullable(v.string())
});

export const TMDBTVSeriesDetailsSchema = v.looseObject({
  adult: v.boolean(),
  backdrop_path: v.nullable(v.string()),
  created_by: v.array(CreatedBySchema),
  episode_run_time: v.array(v.number()),
  first_air_date: v.string(),
  genres: v.array(GenreSchema),
  homepage: v.string(),
  id: v.number(),
  in_production: v.boolean(),
  languages: v.array(v.string()),
  last_air_date: v.string(),
  last_episode_to_air: v.nullable(LastEpisodeSchema),
  name: v.string(),
  next_episode_to_air: v.nullable(LastEpisodeSchema),
  networks: v.array(NetworkSchema),
  number_of_episodes: v.number(),
  number_of_seasons: v.number(),
  origin_country: v.array(v.string()),
  original_language: v.string(),
  original_name: v.string(),
  overview: v.string(),
  popularity: v.number(),
  poster_path: v.nullable(v.string()),
  production_companies: v.array(ProductionCompanySchema),
  production_countries: v.array(ProductionCountrySchema),
  seasons: v.array(SeasonSchema),
  spoken_languages: v.array(SpokenLanguageSchema),
  status: v.string(),
  tagline: v.string(),
  type: v.string(),
  vote_average: v.number(),
  vote_count: v.number()
});

export type TMDBTVSeriesDetails = v.InferOutput<
  typeof TMDBTVSeriesDetailsSchema
>;

// ============================================================================
// TV SEASON DETAILS
// ============================================================================

const CrewSchema = v.looseObject({
  job: v.string(),
  department: v.string(),
  credit_id: v.string(),
  adult: v.boolean(),
  gender: v.number(),
  id: v.number(),
  known_for_department: v.string(),
  name: v.string(),
  original_name: v.string(),
  popularity: v.number(),
  profile_path: v.nullable(v.string())
});

const GuestStarSchema = v.looseObject({
  character: v.string(),
  credit_id: v.string(),
  order: v.number(),
  adult: v.boolean(),
  gender: v.number(),
  id: v.number(),
  known_for_department: v.string(),
  name: v.string(),
  original_name: v.string(),
  popularity: v.number(),
  profile_path: v.nullable(v.string())
});

const EpisodeSchema = v.looseObject({
  air_date: v.nullable(v.string()),
  episode_number: v.number(),
  episode_type: v.string(),
  id: v.number(),
  name: v.string(),
  overview: v.string(),
  production_code: v.string(),
  runtime: v.nullable(v.number()),
  season_number: v.number(),
  show_id: v.number(),
  still_path: v.nullable(v.string()),
  vote_average: v.number(),
  vote_count: v.number(),
  crew: v.array(CrewSchema),
  guest_stars: v.array(GuestStarSchema)
});

export const TMDBTVSeasonDetailsSchema = v.looseObject({
  _id: v.string(),
  air_date: v.nullable(v.string()),
  episodes: v.array(EpisodeSchema),
  name: v.string(),
  overview: v.string(),
  id: v.number(),
  poster_path: v.nullable(v.string()),
  season_number: v.number(),
  vote_average: v.number()
});

export type TMDBTVSeasonDetails = v.InferOutput<
  typeof TMDBTVSeasonDetailsSchema
>;

/**
 * Valibot schemas for validating Plex webhook payloads
 */

// Tag schema (used for Directors, Genres, etc.)
const TagSchema = v.object({
  tag: v.string()
});

// Plex Metadata schema - using looseObject to allow additional fields Plex may send
const PlexMetadataSchema = v.looseObject({
  librarySectionType: v.string(),
  ratingKey: v.string(),
  key: v.string(),
  parentRatingKey: v.optional(v.string()),
  grandparentRatingKey: v.optional(v.string()),
  guid: v.string(),
  parentGuid: v.optional(v.string()),
  grandparentGuid: v.optional(v.string()),
  type: v.picklist(["show", "season", "episode", "movie"]),
  title: v.string(),
  titleSort: v.optional(v.string()),
  grandparentKey: v.optional(v.string()),
  parentKey: v.optional(v.string()),
  librarySectionTitle: v.string(),
  librarySectionID: v.number(),
  librarySectionKey: v.string(),
  contentRating: v.optional(v.string()),
  summary: v.optional(v.string()),
  index: v.optional(v.number()),
  parentIndex: v.optional(v.number()),
  parentTitle: v.optional(v.string()),
  grandparentTitle: v.optional(v.string()),
  thumb: v.optional(v.string()),
  art: v.optional(v.string()),
  parentThumb: v.optional(v.string()),
  grandparentThumb: v.optional(v.string()),
  grandparentArt: v.optional(v.string()),
  addedAt: v.number(),
  updatedAt: v.number(),
  // Movie-specific fields
  year: v.optional(v.number()),
  duration: v.optional(v.number()),
  originallyAvailableAt: v.optional(v.string()),
  studio: v.optional(v.string()),
  rating: v.optional(v.number()),
  tagline: v.optional(v.string()),
  // Additional optional fields found in real payloads
  slug: v.optional(v.string()),
  originalTitle: v.optional(v.string()),
  audienceRating: v.optional(v.number()),
  audienceRatingImage: v.optional(v.string()),
  viewedLeafCount: v.optional(v.number()),
  // Arrays of tags
  Director: v.optional(v.array(TagSchema)),
  Genre: v.optional(v.array(TagSchema)),
  Country: v.optional(v.array(TagSchema)),
  Role: v.optional(v.array(v.any())), // Actor info - complex structure, use any
  Guid: v.optional(v.array(v.any())), // GUID info - complex structure
  Rating: v.optional(v.array(v.any())), // Rating info - complex structure
  Image: v.optional(v.array(v.any())), // Image info - complex structure
  Location: v.optional(v.array(v.any())), // Location paths
  UltraBlurColors: v.optional(v.any()), // Color info for UI
  // Series-specific
  childCount: v.optional(v.number()),
  leafCount: v.optional(v.number())
});

// Account schema
const AccountSchema = v.looseObject({
  id: v.number(),
  thumb: v.string(),
  title: v.string()
});

// Server schema
const ServerSchema = v.looseObject({
  title: v.string(),
  uuid: v.string()
});

// Player schema (optional)
const PlayerSchema = v.looseObject({
  local: v.boolean(),
  publicAddress: v.string(),
  title: v.string(),
  uuid: v.string()
});

// Main Plex Webhook Payload schema
export const PlexWebhookPayloadSchema = v.looseObject({
  event: v.string(),
  user: v.boolean(),
  owner: v.boolean(),
  Account: AccountSchema,
  Server: ServerSchema,
  Player: v.optional(PlayerSchema),
  Metadata: PlexMetadataSchema
});

export type PlexWebhookPayload = v.InferOutput<typeof PlexWebhookPayloadSchema>;
