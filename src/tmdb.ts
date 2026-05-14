import { TMDBMovieDetailsSchema, TMDBTVSeasonDetailsSchema, TMDBTVSeriesDetailsSchema } from "./schema";
import * as v from "valibot";

export async function fetchMovieDetails(movieId: string) {
  const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  const result = v.safeParse(TMDBMovieDetailsSchema, await response.json());
  if (!result.success) {
    throw new Error(`Failed to parse TMDB API response`);
  }
  return result.output;
}

export async function fetchTVSeriesDetails(seriesId: string) {
  const response = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  const result = v.safeParse(TMDBTVSeriesDetailsSchema, await response.json());
  if (!result.success) {
    throw new Error(`Failed to parse TMDB API response`);
  }
  return result.output;
}

export async function fetchTVSeasonDetails(seriesId: string, seasonNumber: number) {
  const response = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  const result = v.safeParse(TMDBTVSeasonDetailsSchema, await response.json());
  if (!result.success) {
    throw new Error(`Failed to parse TMDB API response`);
  }
  return result.output;
}
