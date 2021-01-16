const axios = require('axios');
const constants = require('./constants.js');
// const odds_json = require('./sport-odds.json');

exports.main = async () => {
  let sportKeys = constants.SPORT_KEYS;
  let bookieRegion = 'us';
  let betMarket = 'h2h';
  for (key of sportKeys) {
    const upcomingEvents = await findUpcomingEvents(
      key,
      bookieRegion,
      betMarket
    );
    if (upcomingEvents != null) {
      printHedgeEvents(upcomingEvents);
      printValueOdds(upcomingEvents);
      printArbitrageEvents(upcomingEvents);
    }
  }
};

// exports.main();
// printValueOdds(odds_json.data);
// findInSeasonSports();
// printArbitrageEvents(odds_json.data);

async function findInSeasonSports() {
  try {
    const response = await axios.get('https://api.the-odds-api.com/v3/sports', {
      params: {
        api_key: constants.ODDS_API_KEY,
      },
    });

    console.log(response.data.data);
    sports = [];
    for (sport of response.data.data) {
      sports.push(sport.key);
    }
    console.log(sports);
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
    console.log(upcomingEvents.length + ' events found for sport ' + key);
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

function printArbitrageEvents(events) {
  for (const sportEvent of events) {
    // Remove sites that include draw in the h2h odds.
    const nonDrawSites = sportEvent.sites.filter(
      (site) => site.odds.h2h.length < 3
    );
    // No sites, skip.
    if (nonDrawSites.length == 0) {
      continue;
    }
    // Find site that gives the max odds for teams or draw event.
    const maxOddsFirstSite = nonDrawSites.reduce((prev, current) =>
      prev.odds.h2h[0] > current.odds.h2h[0] ? prev : current
    );
    const maxOddsSecondSite = nonDrawSites.reduce((prev, current) =>
      prev.odds.h2h[1] > current.odds.h2h[1] ? prev : current
    );
    const probFirstTeam = 1 / maxOddsFirstSite.odds.h2h[0];
    const probSecondTeam = 1 / maxOddsSecondSite.odds.h2h[1];

    if (probFirstTeam + probSecondTeam < 0.98) {
      // Market margin is under 98%
      const mktMargin = probFirstTeam + probSecondTeam;
      const firstTeamStake = (
        (constants.OVERALL_STAKE * probFirstTeam) /
        mktMargin
      ).toFixed(2);
      const secondTeamStake = (
        (constants.OVERALL_STAKE * probSecondTeam) /
        mktMargin
      ).toFixed(2);
      const payOut = average(
        firstTeamStake * maxOddsFirstSite.odds.h2h[0],
        secondTeamStake * maxOddsSecondSite.odds.h2h[1]
      ).toFixed(2);
      const profit = (payOut - constants.OVERALL_STAKE).toFixed(2);
      const roi = numToPercent(profit / constants.OVERALL_STAKE);
      const msg =
        `Surebet Found: ${sportEvent.teams[0]} vs. ${sportEvent.teams[1]} (${sportEvent.sport_nice})\n` +
        `${dateString(sportEvent.commence_time)}\n` +
        `${maxOddsFirstSite.site_nice}: ${sportEvent.teams[0]} - ${maxOddsFirstSite.odds.h2h[0]} (Bet: $${firstTeamStake})\n` +
        `${maxOddsSecondSite.site_nice}: ${sportEvent.teams[1]} - ${maxOddsSecondSite.odds.h2h[1]} (Bet: $${secondTeamStake})\n` +
        `Profit: $${profit} (ROI: ${roi}%)`;
      sendTextMessage(msg);
      console.log(msg);
    }
  }
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
    // No sites, skip.
    if (sportEvent.sites.length == 0) {
      continue;
    }
    [0, 1].forEach((index) => {
      let valueBet = findValueBet(sportEvent, index);
      if (valueBet != null) {
        // Value bet found.
        const site = valueBet[0];
        const avgProb = valueBet[1];
        const opp = index == 0 ? sportEvent.teams[1] : sportEvent.teams[0];
        const msg =
          `Value Odd Found: ${sportEvent.teams[index]} vs. ${opp} (${sportEvent.sport_nice})\n` +
          `${dateString(sportEvent.commence_time)}\n` +
          `${site.site_nice} : ${sportEvent.teams[index]} - ${site.odds.h2h[index]}\n` +
          `Average Odds : ${1 / avgProb}\n` +
          `Estimated edge: ${numToPercent(
            avgProb - 1 / site.odds.h2h[index]
          )}%`;
        // sendTextMessage(msg);
        console.log(msg);
      }
    });
  }
}

function findValueBet(sportEvent, index) {
  // Average odd probabilities of first team across bookies.
  const averageProb = oddsAverage(sportEvent, index);
  // Odds of event are below threshold.
  if (averageProb <= constants.ODDS_ADJUSTMENT) {
    return null;
  }
  // Find site that gives the max odds.
  const maxOddsSite = sportEvent.sites.reduce((prev, current) =>
    prev.odds.h2h[index] > current.odds.h2h[index] ? prev : current
  );
  const maxOdds = maxOddsSite.odds.h2h[index];

  if (maxOdds > 1 / (averageProb - constants.ODDS_ADJUSTMENT)) {
    // Value bet found.
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
    date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }) +
    ' ' +
    date.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

function numToPercent(num) {
  num = num * 100;
  return num.toFixed(2);
}

function average(a, b) {
  return (a + b) / 2;
}
