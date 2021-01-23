const dotenv = require('dotenv');
const twilio = require('twilio');

// Load env variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Odds API
exports.ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v3/odds';
exports.ODDS_API_KEY = process.env.ODDS_API_KEY;
// Twilio API
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
exports.smsClient = new twilio(accountSid, authToken);
exports.smsFrom = process.env.SMS_FROM;
exports.smsTo = ['+19162206791', '+19549808358'];

// Constants
exports.ODDS_ADJUSTMENT = 0.15;
exports.OVERALL_STAKE = 100;
exports.SITE_BLOCKLIST = [
  'draftkings',
  'fanduel',
  'williamhill_us',
  'caesars',
  'betmgm',
  'sugarhouse',
  'betrivers',
  'betfair',
];
exports.SPORT_KEYS = [
  'aussierules_afl',
  'basketball_euroleague',
  'basketball_nba',
  'basketball_ncaab',
  'cricket_big_bash',
  'cricket_odi',
  'cricket_test_match',
  'icehockey_nhl',
  'mma_mixed_martial_arts',
  'rugbyleague_nrl',
  'soccer_efl_champ',
  'soccer_england_league1',
  'soccer_england_league2',
  'soccer_epl',
  'soccer_france_ligue_one',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_italy_serie_b',
  'soccer_netherlands_eredivisie',
  'soccer_spain_la_liga',
  'soccer_turkey_super_league',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
];
