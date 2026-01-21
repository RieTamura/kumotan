/**
 * Bluesky API related type definitions
 */

/**
 * Bluesky author information
 */
export interface BlueskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Bluesky post record
 */
export interface BlueskyPostRecord {
  text: string;
  createdAt: string;
  $type: string;
}

/**
 * Bluesky post
 */
export interface BlueskyPost {
  uri: string;
  cid: string;
  author: BlueskyAuthor;
  record: BlueskyPostRecord;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
}

/**
 * Timeline feed item
 */
export interface TimelineFeedItem {
  post: BlueskyPost;
}

/**
 * Timeline response from Bluesky API
 */
export interface TimelineResponse {
  feed: TimelineFeedItem[];
  cursor?: string;
}

/**
 * Image embed in a post
 */
export interface PostImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

/**
 * Post embed types
 */
export interface PostEmbed {
  $type: string;
  images?: PostImage[];
  external?: {
    uri: string;
    title: string;
    description: string;
    thumb?: string;
  };
}

/**
 * Viewer state for a post
 */
export interface PostViewer {
  like?: string; // URI of the like record if liked
  repost?: string; // URI of the repost record if reposted
}

/**
 * Simplified post for display in the app
 */
export interface TimelinePost {
  uri: string;
  cid: string;
  text: string;
  author: {
    handle: string;
    displayName: string;
    avatar?: string;
  };
  createdAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  embed?: PostEmbed;
  viewer?: PostViewer;
}

/**
 * Session data returned from login
 */
export interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  email?: string;
}

/**
 * Stored authentication data
 */
export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  did: string;
  handle: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  identifier: string;
  password: string;
}

/**
 * Bluesky API error response
 */
export interface BlueskyApiError {
  error: string;
  message: string;
}

/**
 * Bluesky user profile information
 */
export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

/**
 * OAuth PKCE challenge pair
 */
export interface PKCEChallenge {
  verifier: string;
  challenge: string;
}

/**
 * OAuth state stored during authorization flow
 */
export interface OAuthState {
  state: string;
  codeVerifier: string;
  timestamp: number;
}

/**
 * OAuth token response from authorization server
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * OAuth authorization URL parameters
 */
export interface OAuthAuthorizationParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

/**
 * OAuth token exchange request
 */
export interface OAuthTokenRequest {
  grant_type: string;
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
}

/**
 * OAuth error response
 */
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}
