import axios from 'axios';
import odds from './sport-odds.json';
import * as constants from './constants.js';

export const main = async () => {
  let sport_key = 'upcoming';
  let sport_region = 'us';
  let sport_market = 'h2h';
  const upcomingEvents = await findUpcomingEvents(
    sport_key,
    sport_region,
    sport_market
  );
  console.log(upcomingEvents);
  if (upcomingEvents != null) printHedgeEvents(upcomingEvents);
};

main();

async function findInSeasonSports() {
  try {
    const response = axios.get('https://api.the-odds-api.com/v3/sports', {
      params: {
        api_key: constants.ODDS_API_KEY,
      },
    });

    console.log(response.data.data);
    return response.data.data;
  } catch (error) {
    console.log('Error status', error.response.status);
    console.log(error.response.data);
    return null;
  }
}

// Get a list of in season sports
// axios
//   .get('https://api.the-odds-api.com/v3/sports', {
//     params: {
//       api_key: constants.ODDS_API_KEY,
//     },
//   })
//   .then((response) => {
//     console.log(
//       `Successfully got ${response.data.data.length} sports.`,
//       `Here's the first sport:`
//     );

//     console.log(response.data.data);
//   })
//   .catch((error) => {
//     console.log('Error status', error.response.status);
//     console.log(error.response.data);
//   });

// To get odds for a sepcific sport, use the sport key from the last request
//   or set sport to "upcoming" to see live and upcoming across all sports
let sport_key = 'upcoming';
let sport_region = 'us';
let sport_market = 'h2h';

async function findUpcomingEvents(key, region, market) {
  try {
    const response = await axios.get(constants.ODDS_API_BASE_URL, {
      params: {
        api_key: constants.ODDS_API_KEY,
        sport: key,
        region: region, // uk | us | eu | au
        mkt: market, // h2h | spreads | totals
        date_format: 'unix',
      },
    });

    // Check your usage
    console.log();
    console.log('Remaining requests', response.headers['x-requests-remaining']);
    console.log('Used requests', response.headers['x-requests-used']);

    // Filter out live events
    const upcomingEvents = response.data.data.filter(
      (event) => event.commence_time * 1000 > Date.now()
    );
    return upcomingEvents;
  } catch (error) {
    console.log('Error status', error.response.status);
    console.log(error.response.data);
    return null;
  }
}

// axios
//   .get(constants.ODDS_API_BASE_URL, {
//     params: {
//       api_key: constants.ODDS_API_KEY,
//       sport: key,
//       region: region, // uk | us | eu | au
//       mkt: market, // h2h | spreads | totals
//       date_format: 'unix',
//     },
//   })
//   .then((response) => {
//     // Events are ordered by start time (live events are first)
//     console.log(
//       `Successfully got ${response.data.data.length} events`,
//       `Here's the first event:`
//     );
//     console.log(JSON.stringify(response.data.data[0]));

//     // Check your usage
//     console.log();
//     console.log('Remaining requests', response.headers['x-requests-remaining']);
//     console.log('Used requests', response.headers['x-requests-used']);

//     // Print hedge odds
//     console.log(response.data);
//     // Filter out live events
//     const result = response.data.data.filter(
//       (event) => event.commence_time * 1000 > Date.now()
//     );
//     printHedgeEvents(result);
//   })
//   .catch((error) => {
//     console.log('Error status', error.response.status);
//     console.log(error.response.data);
//   });

// console.log(odds.data);
// const result = odds.data.filter(
//   (event) => Date(event.commence_time) > Date.now()
// );
// console.log(result);
// printHedgeEvents(odds.data);

function sendTextMessage(msg) {
  constants.smsClient.messages
    .create({
      body: msg,
      from: constants.smsFrom,
      to: constants.smsTo,
    })
    .then((message) => console.log(message.sid));
}

function printHedgeEvents(events) {
  for (const sportEvent of events) {
    let firstTeamDogSites = [];
    let secondTeamDogSites = [];
    for (let i = 0; i < sportEvent.sites.length - 1; i++) {
      let dogTeam;
      let dogOdds;
      if (sportEvent.sites[i].odds.h2h[0] > sportEvent.sites[i].odds.h2h[1]) {
        dogTeam = sportEvent.teams[0];
        dogOdds = sportEvent.sites[i].odds.h2h[0];
        firstTeamDogSites.push(sportEvent.sites[i]);
      } else if (
        sportEvent.sites[i].odds.h2h[0] < sportEvent.sites[i].odds.h2h[1]
      ) {
        dogTeam = sportEvent.teams[1];
        dogOdds = sportEvent.sites[i].odds.h2h[1];
        secondTeamDogSites.push(sportEvent.sites[i]);
      }
      for (let j = i + 1; j < sportEvent.sites.length; j++) {
        let otherDogTeam;
        let otherDogOdds;
        if (sportEvent.sites[j].odds.h2h[0] > sportEvent.sites[j].odds.h2h[1]) {
          otherDogTeam = sportEvent.teams[0];
          otherDogOdds = sportEvent.sites[j].odds.h2h[0];
        } else {
          otherDogTeam = sportEvent.teams[1];
          otherDogOdds = sportEvent.sites[j].odds.h2h[1];
        }
        if (dogTeam != otherDogTeam) {
          // const msg =
          //   `Money Maker: ${sportEvent.sport_nice}\n` +
          //   `${sportEvent.sites[i].site_nice} : ${dogTeam} - ${dogOdds}\n` +
          //   `${sportEvent.sites[j].site_nice} : ${otherDogTeam} - ${otherDogOdds}`;
          // sendTextMessage(msg);
          //console.log(msg);
        }
      }
    }
    if (firstTeamDogSites.length > 0 && secondTeamDogSites.length > 0) {
      console.log(firstTeamDogSites);
      console.log(secondTeamDogSites);
      // Find largest odds from each array
      const maxFirstTeamSite = firstTeamDogSites.reduce((prev, current) =>
        prev.odds.h2h[0] > current.odds.h2h[0] ? prev : current
      );
      const maxSecondTeamSite = secondTeamDogSites.reduce((prev, current) =>
        prev.odds.h2h[1] > current.odds.h2h[1] ? prev : current
      );
      const msg =
        `Money Maker: ${sportEvent.sport_nice}\n` +
        `${maxFirstTeamSite.site_nice} : ${sportEvent.teams[0]} - ${maxFirstTeamSite.odds.h2h[0]}\n` +
        `${maxSecondTeamSite.site_nice} : ${sportEvent.teams[1]} - ${maxSecondTeamSite.odds.h2h[1]}`;
      // sendTextMessage(msg);
      console.log(msg);
    }
  }
}
