/* Capital Clash: configuration. The Supabase publishable key is meant to be public; NEVER put a service_role/secret key here. */

// Fill in after creating the Supabase project (Project Settings -> API Keys).
// The *publishable* key is meant to be public. NEVER put a service_role or secret key here.
const SUPABASE_URL = 'https://tqrhvacwsswvuzjxdipv.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ok9vrk-K-iu7fLTOFi8oeQ_37ogNkru';

const MIN_PLAYERS = 3, MAX_PLAYERS = 10;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


// TEMP TEST FEATURE: lets the host add 2 computer players ("test bots") to try the game alone.
// Set to false (and delete every block marked TEST BOTS) when testing is finished.
const TEST_BOTS = true;
