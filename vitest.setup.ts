import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vite-plus/test";
import type { DiscordWebhookPayload } from "./src/types.js";

// Ensure no stale config files from a previous run contaminate tests
const TEMP_HOME = os.tmpdir();
for (const suffix of ["config-test", "discord-test", "server-test"]) {
  try {
    fs.unlinkSync(path.join(TEMP_HOME, `.plex-monitor.config-${suffix}.json`));
  } catch {
    /* no-op */
  }
}

export const TMDB_MOVIE_POSTER = "/mock-movie-poster.jpg";
export const TMDB_SHOW_POSTER = "/mock-show-poster.jpg";

export const TMDB_MOVIE_TRAILER_KEY = "mock-trailer-key";

const tmdbMovieResponse = {
  id: 11,
  title: "Star Wars",
  poster_path: TMDB_MOVIE_POSTER,
  overview: "A long time ago in a galaxy far, far away...",
  release_date: "1977-05-25",
  genres: [{ id: 28, name: "Action" }],
  vote_average: 8.6,
  vote_count: 20000,
  runtime: 121,
  adult: false,
  backdrop_path: null,
  belongs_to_collection: null,
  budget: 11000000,
  homepage: null,
  imdb_id: "tt0076759",
  origin_country: ["US"],
  original_language: "en",
  original_title: "Star Wars",
  popularity: 100,
  production_companies: [],
  production_countries: [],
  revenue: 775398007,
  spoken_languages: [],
  status: "Released",
  tagline: "A long time ago in a galaxy far, far away....",
  video: false,
  credits: {
    cast: [],
    crew: [
      { id: 1, name: "George Lucas", job: "Director", department: "Directing" }
    ]
  },
  videos: {
    results: [
      {
        id: "abc",
        key: TMDB_MOVIE_TRAILER_KEY,
        name: "Official Trailer",
        site: "YouTube",
        type: "Trailer",
        official: true
      }
    ]
  }
};

const tmdbShowResponse = {
  id: 4607,
  name: "Lost",
  poster_path: TMDB_SHOW_POSTER,
  overview: "Survivors of a plane crash are stranded on a mysterious island.",
  first_air_date: "2004-09-22",
  genres: [{ id: 18, name: "Drama" }],
  vote_average: 7.9,
  vote_count: 5000,
  adult: false,
  backdrop_path: null,
  created_by: [],
  episode_run_time: [43],
  homepage: "",
  in_production: false,
  languages: ["en"],
  last_air_date: "2010-05-23",
  last_episode_to_air: null,
  next_episode_to_air: null,
  networks: [],
  number_of_episodes: 121,
  number_of_seasons: 6,
  origin_country: ["US"],
  original_language: "en",
  original_name: "Lost",
  popularity: 50,
  production_companies: [],
  production_countries: [],
  seasons: [],
  spoken_languages: [],
  status: "Ended",
  tagline: "",
  type: "Scripted"
};

export const discordRequests: DiscordWebhookPayload[] = [];

export const server = setupServer(
  http.get("https://api.themoviedb.org/3/movie/:movieId", () =>
    HttpResponse.json(tmdbMovieResponse)
  ),

  http.get("https://api.themoviedb.org/3/tv/:seriesId", () =>
    HttpResponse.json(tmdbShowResponse)
  ),

  http.post(
    "https://discord.com/api/webhooks/:id/:token",
    async ({ request }) => {
      const body = (await request.json()) as DiscordWebhookPayload;
      discordRequests.push(body);
      return HttpResponse.json({ id: "mock-message-id" }, { status: 200 });
    }
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  discordRequests.length = 0;
});
afterAll(() => server.close());
