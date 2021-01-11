const axios = require('axios');
const constants = require('./constants.js');
const odds_json = require('./sport-odds.json');

exports.main = async () => {
  let sport_key = 'upcoming';
  let sport_region = 'us';
  let sport_market = 'h2h';
  const upcomingEvents = await findUpcomingEvents(
    sport_key,
    sport_region,
    sport_market
  );
  if (upcomingEvents != null) {
    printHedgeEvents(upcomingEvents);
    // printValueOdds(upcomingEvents);
  }
};

// exports.main();
//printValueOdds(odds_json.data);

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

// To get odds for a sepcific sport, use the sport key from the last request
//   or set sport to "upcoming" to see live and upcoming across all sports
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
    console.log(upcomingEvents.length + ' events found.');
    return upcomingEvents;
  } catch (error) {
    console.log('Error status', error.response.status);
    console.log(error.response.data);
    return null;
  }
}

function sendTextMessage(msg) {
  constants.smsClient.messages
    .create({
      body: msg,
      from: constants.smsFrom,
      to: constants.smsTo,
    })
    .then((message) => console.log('Message sent: ' + message.sid));
}

function printHedgeEvents(events) {
  for (const sportEvent of events) {
    let firstTeamDogSites = [];
    let secondTeamDogSites = [];
    for (let i = 0; i < sportEvent.sites.length - 1; i++) {
      if (sportEvent.sites[i].odds.h2h[0] > sportEvent.sites[i].odds.h2h[1]) {
        firstTeamDogSites.push(sportEvent.sites[i]);
      } else if (
        sportEvent.sites[i].odds.h2h[0] < sportEvent.sites[i].odds.h2h[1]
      ) {
        secondTeamDogSites.push(sportEvent.sites[i]);
      }
    }
    if (firstTeamDogSites.length > 0 && secondTeamDogSites.length > 0) {
      // console.dir(firstTeamDogSites, { depth: null });
      // console.dir(secondTeamDogSites, { depth: null });
      // Find largest odds from each array
      const maxFirstTeamSite = firstTeamDogSites.reduce((prev, current) =>
        prev.odds.h2h[0] > current.odds.h2h[0] ? prev : current
      );
      const maxSecondTeamSite = secondTeamDogSites.reduce((prev, current) =>
        prev.odds.h2h[1] > current.odds.h2h[1] ? prev : current
      );
      // Error in lines
      if (
        maxFirstTeamSite.odds.h2h[0] < 2 ||
        maxSecondTeamSite.odds.h2h[1] < 2
      ) {
        continue;
      }
      const msg =
        `Money Maker: ${sportEvent.sport_nice}\n` +
        `${dateString(sportEvent.commence_time)}\n` +
        `${maxFirstTeamSite.site_nice} : ${sportEvent.teams[0]} - ${maxFirstTeamSite.odds.h2h[0]}\n` +
        `${maxSecondTeamSite.site_nice} : ${sportEvent.teams[1]} - ${maxSecondTeamSite.odds.h2h[1]}`;
      sendTextMessage(msg);
      console.log(msg);
    }
  }
}

function printValueOdds(events) {
  for (const sportEvent of events) {
    [0, 1].forEach((index) => {
      let valueBet = findValueBet(sportEvent, index);
      if (valueBet != null) {
        // Value bet found
        const site = valueBet[0];
        const avgProb = valueBet[1];
        const msg =
          `Value Odd Found: ${sportEvent.sport_nice}\n` +
          `${dateString(sportEvent.commence_time)}\n` +
          `${site.site_nice} : ${sportEvent.teams[index]} - ${site.odds.h2h[index]}\n` +
          `Average Odds : ${1 / avgProb}\n` +
          `Estimated edge: ${site.odds.h2h[index] - avgProb / avgProb}%`;
        // sendTextMessage(msg);
        console.log(msg);
      }
    });
  }
}

function findValueBet(sportEvent, index) {
  // Average odds of first team across bookies
  const averageProb = oddsAverage(sportEvent, index);
  // Find max odds
  const maxOddsSite = sportEvent.sites.reduce((prev, current) =>
    prev.odds.h2h[index] > current.odds.h2h[index] ? prev : current
  );

  if (
    1 / maxOddsSite.odds.h2h[index] >
    1 / (averageProb - constants.ODDS_ADJUSTMENT)
  ) {
    // Value bet
    return [maxOddsSite, averageProb];
  }

  return null;
}

function oddsAverage(event, index) {
  let sum = 0;
  for (const site of event.sites) {
    sum += 1 / site.odds.h2h[index];
  }
  return sum / event.sites.length;
}

function dateString(unix) {
  const date = new Date(unix * 1000);
  return (
    date.toLocaleDateString('en-US') +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}
