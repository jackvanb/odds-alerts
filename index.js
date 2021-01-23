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

function printArbitrageEvents(events) {
  for (const sportEvent of events) {
    // Remove sites that we cannot bet from.
    const allowedSites = sportEvent.sites.filter(
      (site) => !constants.SITE_BLOCKLIST.includes(site.site_key)
    );
    // Seperate sites that include draw in the h2h odds.
    const nonDrawSites = allowedSites.filter(
      (site) => site.odds.h2h.length == 2
    );
    const drawSites = allowedSites.filter((site) => site.odds.h2h.length == 3);

    let nonDrawBet;
    let drawBet;
    if (nonDrawSites.length != 0) {
      nonDrawBet = findArbitrageEvent(nonDrawSites, false);
    }
    if (drawSites.length != 0) {
      drawBet = findArbitrageEvent(drawSites, true);
    }

    if (nonDrawBet != null) {
      const { sites, probs } = nonDrawBet;
      const arbOdds = calculateArbitrageOdds(sites, probs, false);
      const msg = formatArbitrageOdds(sites, arbOdds, sportEvent, false);
      sendTextMessage(msg);
      console.log(msg);
    }
    if (drawBet != null) {
      const { sites, probs } = drawBet;
      const arbOdds = calculateArbitrageOdds(sites, probs, true);
      const msg = formatArbitrageOdds(sites, arbOdds, sportEvent, true);
      sendTextMessage(msg);
      console.log(msg);
    }
  }
}

function findArbitrageEvent(sites, hasDrawOutcome) {
  // Find site that gives the max odds for teams or draw event.
  const maxOddsFirstSite = sites.reduce((prev, current) =>
    prev.odds.h2h[0] > current.odds.h2h[0] ? prev : current
  );
  const maxOddsSecondSite = sites.reduce((prev, current) =>
    prev.odds.h2h[1] > current.odds.h2h[1] ? prev : current
  );
  let maxOddsDrawSite = null;
  if (hasDrawOutcome) {
    maxOddsDrawSite = sites.reduce((prev, current) =>
      prev.odds.h2h[2] > current.odds.h2h[2] ? prev : current
    );
  }

  const probFirstTeam = 1 / maxOddsFirstSite.odds.h2h[0];
  const probSecondTeam = 1 / maxOddsSecondSite.odds.h2h[1];
  let probDraw = null;
  if (hasDrawOutcome) {
    probDraw = 1 / maxOddsDrawSite.odds.h2h[2];
  }

  if (hasDrawOutcome) {
    if (probFirstTeam + probSecondTeam + probDraw < 0.98) {
      // Market margin is under 98%, arb event found.
      return {
        sites: [maxOddsFirstSite, maxOddsSecondSite, maxOddsDrawSite],
        probs: [probFirstTeam, probSecondTeam, probDraw],
      };
    }
  } else if (probFirstTeam + probSecondTeam < 0.98) {
    // Market margin is under 98%, arb bet found.
    return {
      sites: [maxOddsFirstSite, maxOddsSecondSite],
      probs: [probFirstTeam, probSecondTeam],
    };
  }

  return null;
}

function calculateArbitrageOdds(sites, probs, hasDrawOutcome) {
  const [firstSite, secondSite, drawSite] = [sites[0], sites[1], sites[2]];
  const [probFirstTeam, probSecondTeam, probDraw] = [
    probs[0],
    probs[1],
    probs[2],
  ];

  const mktMargin = hasDrawOutcome
    ? probFirstTeam + probSecondTeam + probDraw
    : probFirstTeam + probSecondTeam;
  const firstTeamStake = (
    (constants.OVERALL_STAKE * probFirstTeam) /
    mktMargin
  ).toFixed(2);
  const secondTeamStake = (
    (constants.OVERALL_STAKE * probSecondTeam) /
    mktMargin
  ).toFixed(2);
  const drawStake = hasDrawOutcome
    ? ((constants.OVERALL_STAKE * probDraw) / mktMargin).toFixed(2)
    : 0;
  const payOut = hasDrawOutcome
    ? average(
        firstTeamStake * firstSite.odds.h2h[0],
        secondTeamStake * secondSite.odds.h2h[1],
        drawStake * drawSite.odds.h2h[2]
      ).toFixed(2)
    : average(
        firstTeamStake * firstSite.odds.h2h[0],
        secondTeamStake * secondSite.odds.h2h[1]
      ).toFixed(2);
  const profit = (payOut - constants.OVERALL_STAKE).toFixed(2);
  const roi = numToPercent(profit / constants.OVERALL_STAKE);

  return {
    stakes: [
      firstTeamStake,
      secondTeamStake,
      ...(hasDrawOutcome ? [drawStake] : []),
    ],
    profit: profit,
    roi: roi,
  };
}

function formatArbitrageOdds(sites, arbOdds, sportEvent, hasDrawOutCome) {
  const [firstSite, secondSite, drawSite] = [sites[0], sites[1], sites[2]];
  const msg = hasDrawOutCome
    ? `Surebet Found: ${sportEvent.teams[0]} vs. ${sportEvent.teams[1]} (${sportEvent.sport_nice})\n` +
      `${dateString(sportEvent.commence_time)}\n` +
      `${firstSite.site_nice}: ${sportEvent.teams[0]} - ${firstSite.odds.h2h[0]} (Bet: $${arbOdds.stakes[0]})\n` +
      `${secondSite.site_nice}: ${sportEvent.teams[1]} - ${secondSite.odds.h2h[1]} (Bet: $${arbOdds.stakes[1]})\n` +
      `${drawSite.site_nice}: Draw - ${drawSite.odds.h2h[2]} (Bet: $${arbOdds.stakes[2]})\n` +
      `Profit: $${arbOdds.profit} (ROI: ${arbOdds.roi}%)`
    : `Surebet Found: ${sportEvent.teams[0]} vs. ${sportEvent.teams[1]} (${sportEvent.sport_nice})\n` +
      `${dateString(sportEvent.commence_time)}\n` +
      `${firstSite.site_nice}: ${sportEvent.teams[0]} - ${firstSite.odds.h2h[0]} (Bet: $${arbOdds.stakes[0]})\n` +
      `${secondSite.site_nice}: ${sportEvent.teams[1]} - ${secondSite.odds.h2h[1]} (Bet: $${arbOdds.stakes[1]})\n` +
      `Profit: $${arbOdds.profit} (ROI: ${arbOdds.roi}%)`;
  return msg;
}

function printValueOdds(events) {
  for (const sportEvent of events) {
    const nonDrawSites = sportEvent.sites.filter(
      (site) => site.odds.h2h.length == 2
    );
    const drawSites = sportEvent.sites.filter(
      (site) => site.odds.h2h.length == 3
    );
    if (drawSites.length > 2) {
      [0, 1, 2].forEach((index) => {
        let valueBet = findValueBet(drawSites, index);
        if (valueBet != null) {
          // Value bet found.
          const site = valueBet[0];
          const avgProb = valueBet[1];
          const opp = index == 0 ? sportEvent.teams[1] : sportEvent.teams[0];
          const team =
            index == 2
              ? 'Draw'
              : index == 0
              ? sportEvent.teams[0]
              : sportEvent.teams[1];
          const msg =
            `Value Odd Found: ${sportEvent.teams[0]} vs. ${sportEvent.teams[1]} (${sportEvent.sport_nice})\n` +
            `${dateString(sportEvent.commence_time)}\n` +
            `${site.site_nice} : ${team} - ${site.odds.h2h[index]}\n` +
            `Average Odds : ${(1 / avgProb).toFixed(2)}\n` +
            `Estimated edge: ${numToPercent(
              avgProb - 1 / site.odds.h2h[index]
            )}%`;
          sendTextMessage(msg);
          console.log(msg);
        }
      });
    }
    if (nonDrawSites.length > 2) {
      [0, 1].forEach((index) => {
        let valueBet = findValueBet(nonDrawSites, index);
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
          sendTextMessage(msg);
          console.log(msg);
        }
      });
    }
  }
}

function findValueBet(sites, index) {
  // Average odd probabilities of first team across bookies.
  const averageProb = oddsAverage(sites, index);
  // Odds of event are below threshold.
  if (averageProb <= constants.ODDS_ADJUSTMENT) {
    return null;
  }
  // Find site that gives the max odds.
  const maxOddsSite = sites.reduce((prev, current) =>
    prev.odds.h2h[index] > current.odds.h2h[index] ? prev : current
  );
  const maxOdds = maxOddsSite.odds.h2h[index];

  if (maxOdds > 1 / (averageProb - constants.ODDS_ADJUSTMENT)) {
    // Value bet found.
    return [maxOddsSite, averageProb];
  }

  return null;
}

/*
Utils
*/
function sendTextMessage(msg) {
  constants.smsTo.forEach((number) => {
    constants.smsClient.messages
      .create({
        body: msg,
        from: constants.smsFrom,
        to: number,
      })
      .then((message) => console.log('Message sent: ' + message.sid))
      .catch((error) => console.log(error.message));
  });
}

function oddsAverage(sites, index) {
  let sum = 0;
  for (const site of sites) {
    sum += 1 / site.odds.h2h[index];
  }
  return sum / sites.length;
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

function average(...args) {
  return (
    args.reduce((previous, current) => {
      return previous + current;
    }) / args.length
  );
}
