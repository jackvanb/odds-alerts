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
exports.smsTo = process.env.SMS_TO;

// Constants
exports.ODDS_ADJUSTMENT = 0.05;
exports.SPORT_KEYS = [
  'americanfootball_nfl',
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
];
