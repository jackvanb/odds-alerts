import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Load env variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Odds API
export const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v3/odds';
export const ODDS_API_KEY = process.env.ODDS_API_KEY;
// Twilio API
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
export const smsClient = require('twilio')(accountSid, authToken);
export const smsFrom = process.env.SMS_FROM;
export const smsTo = process.env.SMS_TO;
