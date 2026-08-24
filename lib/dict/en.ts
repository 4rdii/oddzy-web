/**
 * English copy. This is the shape every other locale must satisfy — `Dict` is
 * inferred from it, so adding a key here is a type error in `fa.ts` until it is
 * translated. Strings are kept verbatim from the pre-i18n components so the
 * English site renders byte-identically after the extraction.
 */
export const en = {
  nav: {
    updown: "Up or Down",
    howItWorks: "How it works",
    learn: "Learn",
    faq: "FAQ",
    signIn: "Sign in",
    primary: "Primary",
    browseTopics: "Browse markets by topic",
    baskets: "Baskets",
    footerPrimary: "Footer primary",
  },
  cta: {
    startTrading: "Start trading",
    openTelegram: "Open in Telegram",
  },
  home: {
    metaTitle: "Oddzy — Prediction markets, in your pocket",
    metaDescription:
      "Put a price on what happens next. Trade Polymarket prediction markets from Telegram or the web — self-custodial wallet, on-chain settlement, no bookmaker margin.",
    pill: "LIVE MARKETS · UPDATED CONTINUOUSLY",
    kicker: "PREDICTION MARKETS",
    h1: "Put a price on what you think happens next.",
    lead: "Oddzy is an interface to Polymarket prediction markets. Trade from Telegram or right here — your wallet is self-custodial, and every position settles on-chain.",
    tradingNow: "TRADING NOW",
    busiest: "Busiest right now",
    in24h: "in 24h",
    howItWorks: "How it works",
    readWalkthrough: "Read the full walkthrough →",
    learn: "Learn",
    allArticles: "All articles →",
    minRead: "MIN READ",
    orgDescription:
      "An interface to Polymarket prediction markets, available in Telegram and on the web.",
  },
  steps: [
    {
      t: "Wallet in one tap",
      d: "Opening the mini app creates a self-custodial wallet via Privy. No seed phrase, no install, no exchange account.",
    },
    {
      t: "Price, not a punt",
      d: "A market at 62¢ means the crowd prices that outcome at 62%. Pay 62¢, get $1 if you are right.",
    },
    {
      t: "Settles on-chain",
      d: "At resolution the market settles on Polygon and proceeds land in your wallet — every step verifiable.",
    },
  ],
  faq: {
    metaTitle: "FAQ",
    metaDescription:
      "Is Oddzy custodial? How is it different from a sportsbook? What's the minimum stake? Answers to the common questions about trading prediction markets on Oddzy.",
    h1: "Frequently asked questions",
    items: [
      {
        q: "Is Oddzy custodial?",
        a: "No. Your wallet is generated through Privy and the keys stay with you. Oddzy never holds or moves your balance — it signs orders you approve, and you can revoke that permission or export your private key at any time.",
      },
      {
        q: "How is this different from a sportsbook?",
        a: "There is no bookmaker setting a margin. Prices come from other users buying and selling shares, so a 62¢ price is a 62% crowd probability, and you can exit before resolution.",
      },
      {
        q: "What is the minimum stake?",
        a: "$1. Network fees on Polygon are fractions of a cent, so small positions stay economical.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. Oddzy runs inside Telegram as a mini app, and this same site becomes that app when opened from the bot.",
      },
      {
        q: "Which network and token do I deposit?",
        a: "USDC on Polygon. Funds sent on another network or in another token cannot be recovered.",
      },
      {
        q: "How do markets resolve?",
        a: "Resolution happens on-chain through Polymarket. Where an outcome is disputed, the UMA optimistic oracle decides.",
      },
      {
        q: "Can I lose money?",
        a: "Yes. You can lose your entire stake on any position. Prediction markets are risky and are not suitable for everyone. 18+.",
      },
    ],
  },
  how: {
    metaTitle: "How it works",
    metaDescription:
      "Deposit, pick, settle. How trading prediction markets on Oddzy works step by step — wallet, funding, orders, and on-chain settlement.",
    h1: "How it works",
    lead: "Deposit, pick, settle. Six steps from a cold start to a settled position.",
    beforeYouStart: "Before you start",
    risk: "You can lose your entire stake. Prices move against you, thin markets fill worse than the quote suggests, and resolution can take time. Stake what you can afford to lose. 18+.",
    steps: [
      {
        t: "Open the bot, get a wallet",
        d: "Start the bot in Telegram and open the mini app. A self-custodial wallet is created for you through Privy — no seed phrase to record, no extension to install, no exchange account. The keys are yours: you can export them or revoke signing permission whenever you want.",
      },
      {
        t: "Fund it with USDC on Polygon",
        d: "You get a deposit address. Send USDC on the Polygon network — from an exchange withdrawal or another wallet. Deposits are detected automatically and your balance updates in the bot. The minimum stake is $1, so a small first deposit is fine.",
      },
      {
        t: "Pick a market and a side",
        d: "Browse by category. Each market shows YES and NO prices in cents, volume traded, and the resolution date. A price of 62¢ means the market prices that outcome at about 62% — you pay 62 cents for a share that pays $1 if you're right.",
      },
      {
        t: "Confirm — the order signs on-chain",
        d: "Check the payout preview, then confirm. The order is signed from your wallet and submitted to Polymarket's order book. You get a receipt with the transaction hash. Orders are filled at the best available price, capped so a thin book can't fill you far above the quote.",
      },
      {
        t: "Hold, or exit early",
        d: "Your position shows live P&L. Unlike a fixed-odds bet, you can sell before resolution at the current market price — taking a profit or cutting a loss if your view changes.",
      },
      {
        t: "Settlement",
        d: "When the market resolves, winning shares pay $1 each directly to your wallet. Resolution happens on-chain via Polymarket's oracle; disputed outcomes go to the UMA optimistic oracle.",
      },
    ],
  },
  market: {
    metaDescription:
      "The market puts {title} at {chance}%, with {volume} traded in the last 24 hours. Live price, resolution rules and history.",
    answer: "The market prices this at {chance}%, backed by {volume} of trading in the last 24 hours.",
    chanceYes: "chance, according to the market",
    backedBy: "Backed by ",
    backedBySuffix: " traded in the last 24 hours — this is a price people are staking money on, not a forecast.",
    metaDescriptionResolved:
      "{title} — the market resolved {outcome}. Final price, how it moved, and the rules that decided it.",
    resolvedYes: "Yes",
    resolvedNo: "No",
    resolvedUnknown: "Resolved",
    resolvedSub: "Settled on-chain after ",
    resolvedSubSuffix: " of lifetime trading. The rules that decided it are below.",
    resolvedNotice: "This market has resolved.",
    rulesHeading: "How this resolves",
    rulesLead:
      "The rules below decide who gets paid. Read them before the price — most surprises are definitional, not predictive.",
    ctaLead: "Follow this market, or take a position, straight from Telegram.",
    asOf: "Price as of",
    source: "Source: Polymarket",
    history: {
      heading: "How the price has moved",
      since: "On {date} the market put this at {pct}%.",
      empty: "We started recording this market's daily price today — the history will build from here.",
      now: "now",
    },
    /** Shown on a market that is one deadline of a rolling question. */
    partOfSeries: "This is the {date} deadline of an ongoing question.",
    seeCurrent: "See the current market →",
  },
  series: {
    metaDescription:
      "{title} — the live market price, every past deadline and how each resolved. Updated as the question rolls forward.",
    metaDescriptionResolved:
      "{title} — every deadline this question has run through and how each one resolved.",
    /** The question stripped of its deadline, used as the page's H1 lead-in. */
    currentHeading: "Right now",
    currentDeadline: "Deadline: {date}",
    timelineHeading: "Every deadline so far",
    timelineLead:
      "Polymarket re-lists this question at successive deadlines. Each row is one of them, with how it resolved.",
    open: "Open",
    awaiting: "Awaiting settlement",
    resolvedYes: "Yes",
    resolvedNo: "No",
    resolvedUnknown: "Resolved",
    current: "Current",
    /** Link from a settled leg forward to the one that is live now. */
    successorLead: "This deadline has passed. The question continues:",
    noSuccessor: "Every deadline for this question has passed.",
    viewLeg: "View this deadline →",
  },
  updown: {
    metaTitle: "Up or Down — 15-minute bitcoin, ethereum and solana markets",
    metaDescription:
      "Take a side on where BTC, ETH or SOL goes over the next fifteen minutes. Resolves on the average price across the window, not the closing price.",
    h1: "Up or Down",
    lead: "Pick a coin, pick a side. A window runs fifteen minutes, and your result lands a few minutes after it closes. Minutes, not months.",
    rule:
      "Resolves Up if the average price across the window is at or above the price when the window opened. Not where it ends — the average. A tie resolves Up.",
    none: "No windows are open right now. They open continuously — check back in a minute.",
    closesIn: "until close",
    opensIn: "until open",
    up: "Up",
    down: "Down",
    volume: "vol",
    resolvedUp: "Up ✓",
    resolvedDown: "Down ✓",
    finalResult: "final result",
    closing: "closing",
    notStarted: "This window hasn't opened yet — the chart appears once it starts",
    loadingPrices: "loading prices…",
    anchor: "open",
    average: "avg",
    price: "spot",
    chartOpen: "open",
    chartNow: "now",
    chartClose: "close",
    priceToBeat: "Price to beat",
    startPrice: "Price to beat",
    currentPrice: "Current price",
    finalPrice: "Final average",
    live: "live",
    resolvedTag: "resolved",
    nextTag: "next window",
    interval: "15 min",
    payoutHeading: "What it pays",
    payoutLead: "A share pays $1 if it wins, so the payout is your stake divided by the price. Trades are placed in the app.",
    win: "pays",
    cta: "Open in Telegram",
    terms: "Prices are live and move continuously — the price you get is the price when your order fills, not the one shown here.",
    otherMarkets: "Other coins",
    upWon: "Up won",
    downWon: "Down won",
  },
  basket: {
    indexMetaTitle: "Baskets — buy a whole thesis in one click",
    indexMetaDescription:
      "Curated sets of prediction-market positions. One click buys every leg at its stated weight, and each leg settles on its own.",
    indexH1: "Baskets",
    indexLead:
      "A basket is a set of positions with a weight on each. It is not a parlay: buying one places every position as a separate trade, each settles on its own, and you don't need them all to come in.",
    empty: "No baskets are published yet.",
    metaTitle: "{title} — a basket of {count} positions",
    metaDescription:
      "{title}: {count} prediction-market positions bought in one click, each at its stated weight. Live prices and what the basket costs.",
    /**
     * The single most important thing to say, because "buy 4 positions at once"
     * reads as a parlay to anyone who has used a sportsbook. It is the opposite:
     * the legs are independent, and partial success is the normal case.
     */
    notParlay:
      "This is not a parlay. Each position is bought and settles on its own — you don't need them all to come in, and you can sell any one of them without touching the rest.",
    legsHeading: "What's in it",
    legsLead: "Each row is a separate position. The weight is that leg's share of whatever you put in.",
    /** Column headers for the legs table. */
    colWeight: "Weight",
    colSide: "Side",
    colPrice: "Price",
    blendedHeading: "Blended price",
    blendedLead:
      "The weighted average of the legs — what one unit of this basket costs as a probability.",
    /**
     * Payout figures, quoted per $100 because the web page has no stake input.
     *
     * Two forms, because two kinds of basket. An independent basket can have
     * every leg hit at once, so "if everything hits" is collectable. An
     * exclusive one — five clubs, one trophy — cannot, and quoting that number
     * would advertise a return nobody can reach.
     */
    payoutHeading: "If it comes good",
    payoutAllHit: "{amount} back on {stake} — {multiple}× — if every position hits.",
    payoutEven: "Every {stake} turns into {amount} — {multiple}×, whichever one wins.",
    payoutEvenLead:
      "The stake is split to buy the same number of shares in each, so the winner doesn't change what it pays. The risk is that none of them wins.",
    payoutRange:
      "Only one of these can win. Depending which, {stake} returns between {low} and {high}.",
    payoutRangeWarn:
      "Note the bottom of that range: an even split across five contenders pays back less than you put in if the favourite wins. The longer prices are where this basket makes money.",
    payoutNested:
      "The rungs are nested — clearing a higher level means every level below it cleared too.",
    curated: "Editorial",
    legCount: "{count} positions",
    buys: "{count} buys",
    settled: "Every position in this basket has settled.",
    /** The honest caveat, shown on every basket page. */
    partialNotice:
      "Legs are placed as separate orders. If one can't fill at the price shown, the rest still go through and that leg's share stays in your balance.",
    minStake: "Minimum {amount} — the smallest leg needs at least the minimum bet.",
    cta: "Buy this basket in Telegram",
  },
  topic: {
    metaTitle: "{topic} — what the market says",
    metaDescription:
      "Live probabilities for {topic}, priced by a market with real money behind it. Updated continuously.",
    h1: "{topic}: what the market says",
    lead:
      "Every question below is priced by people staking money on the answer. The percentage is the market's probability, and the volume tells you how much to trust it.",
    ongoing: "Ongoing questions",
    deadlines: "{count} deadlines so far",
    vol: "24h volume",
  },
  learn: {
    metaTitle: "Learn — prediction markets explained",
    metaDescription:
      "Guides and analysis on prediction markets: how prices become probabilities, how they differ from sportsbooks, and how to trade them from Telegram.",
    h1: "Learn",
    lead: "How prediction markets work, what the prices actually mean, and how to trade them without getting the basics wrong.",
    backToAll: "← All articles",
    minRead: "MIN READ",
    keyTakeaways: "Key takeaways",
    onThisPage: "On this page",
    faqTitle: "Common questions",
    related: "Keep reading",
    breadcrumbBlog: "Learn",
    updated: "Updated",
    words: "words",
  },
  footer: {
    rights: "An interface to Polymarket prediction markets.",
    risk: "Trading prediction markets involves risk of loss and is not suitable for everyone. 18+. Oddzy is non-custodial and never holds your funds. Not available in restricted jurisdictions.",
  },
  theme: {
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
  },

  /**
   * The trading surface (`components/app/*`). Grouped by screen rather than by
   * string kind so a translator can work a screen at a time.
   *
   * Interpolated copy is a `{placeholder}` template rather than a function:
   * this dictionary is handed to client components as a prop, so it has to stay
   * serializable. `tf`/`tn` from LocaleProvider fill them in. Count-dependent
   * strings carry both plural forms, because English pluralisation ("1 MARKET" /
   * "2 MARKETS") is a per-locale rule that Persian does not share — keeping both
   * forms here stops an English "S" from leaking into every translation.
   *
   * Money and addresses are deliberately NOT interpolated into these strings.
   * They are rendered as separate `.ltr-num` spans so bidi can't reorder them
   * inside Persian text, which means the dictionary only carries the words
   * around them (e.g. `balance` = "Balance", not "Balance {amount}").
   */
  app: {
    nav: {
      main: "Main",
      markets: "Markets",
      browse: "Browse",
      positions: "Positions",
      wallet: "Wallet",
      baskets: "Baskets",
      updown: "Up/Down",
    },

    baskets: {
      title: "Baskets",
      lead: "A set of positions with a weight on each. One tap buys them all.",
      notParlay:
        "Not a parlay — each position settles on its own, so you don't need them all to come in.",
      payoutHeading: "If it comes good",
      payoutAllHit: "{amount} back on {stake} — {multiple}× — if every position hits.",
        payoutEven: "Every {stake} turns into {amount} — {multiple}×, whichever one wins.",
      payoutEvenLead:
        "The stake is split to buy the same number of shares in each, so the winner doesn't change what it pays. The risk is that none of them wins.",
      payoutRange: "Only one can win. Depending which, {stake} returns {low} – {high}.",
      payoutRangeWarn:
        "The even split means the favourite pays back less than you put in — the longer prices are where this basket makes money.",
      empty: "No baskets are published yet.",
      legs: "{count} positions",
      weight: "Weight",
      minStake: "Minimum ${amount}",
      /** The partial-fill contract, shown before the user commits. */
      partialNotice:
        "Each leg is a separate order. If one can't fill at the price shown, the rest still go through and that leg's share stays in your balance.",
      amount: "Amount",
      buy: "Buy basket",
      buying: "Buying…",
      belowMin: "This basket needs at least ${amount}.",
      insufficient: "That's more than your balance.",
      skipping: "{count} skipped — no price right now",
      /** Receipt. */
      boughtTitle: "Basket bought",
      partialTitle: "Partially filled",
      failedTitle: "Nothing filled",
      filledOf: "${filled} of ${requested}",
      unspent: "${amount} stayed in your balance.",
      reasonNoFill: "price moved",
      reasonSettled: "already settled",
      reasonUnbuyable: "no seller",
      reasonNoQuote: "no price",
      reasonBelowMin: "below minimum",
      reasonError: "not placed",
      viewPositions: "View positions",
      done: "Done",
    },

    feed: {
      searchPlaceholder: "Search markets",
      searchLabel: "Search markets",
      browse: "Browse",
      clearFilter: "Clear {name} filter",
      loading: "LOADING…",
      results: { one: "{n} RESULT", other: "{n} RESULTS" },
      events: { one: "{n} EVENT · BY KICK-OFF", other: "{n} EVENTS · BY KICK-OFF" },
      markets: { one: "{n} MARKET · BY 24H VOLUME", other: "{n} MARKETS · BY 24H VOLUME" },
      loadError: "Couldn't load markets.",
      noMatch: "Nothing matches “{query}”.",
      empty: "No live markets here right now.",
      yes: "YES",
      no: "NO",
      buyYes: "Buy Yes at {percent} percent",
      buyNo: "Buy No at {percent} percent",
      vol: "VOL",
      /** Resolution countdown on a market card — see `untilClose` in lib/format. */
      closes: {
        unknown: "—",
        closed: "closed",
        days: "in {n} days",
        hours: "in {n}h",
        soon: "under 1h",
      },
    },

    browse: {
      title: "Browse",
      pathLabel: "Category path",
      all: "All",
      allMarkets: "All {name} markets",
      marketCount: { one: "{n} market", other: "{n} markets" },
      /** Appended after the market count; carries its own separator. */
      subCount: "{n} subcategories",
      /** Drill-in chevron. Mirrored in RTL. */
      chevron: "›",
      empty: "Nothing below this category.",
    },

    event: {
      hide: "Hide",
      extra: "Extra markets",
      vol: "VOL",
      draw: "DRAW",
    },

    /** Derivative market groupings, keyed by `KIND_GROUPS[].key`. */
    kinds: {
      total: "Totals (over/under)",
      spread: "Spreads",
      btts: "Both teams to score",
      halftime: "Halftime",
      corners: "Corners",
      advance: "To advance",
      h2h: "Head to head",
      prop: "Player props",
      other: "Other markets",
    },

    detail: {
      back: "← Back",
      volume: "VOLUME",
      h24: "24H",
      resolves: "RESOLVES",
      resolutionTitle: "RESOLUTION",
      resolutionBody:
        "When the result is in, every winning share pays $1 straight to your wallet. Polymarket's oracle calls the outcome; a disputed result goes to UMA.",
      showMore: "Read the full rules",
      showLess: "Show less",
      viewOnPolymarket: "View on Polymarket ↗",
      risk: "Prediction markets carry risk of loss. 18+. Oddzy is an interface to Polymarket — it never holds your funds.",
    },

    updown: {
      title: "Up or Down",
      rule:
        "Resolves Up if the AVERAGE price across the window is at or above the price when it opened. Not where it ends — the average.",
      loading: "Loading…",
      none: "No window is open for this coin right now. They open continuously.",
      interval: "15 min",
      closesIn: "CLOSES IN",
      closing: "CLOSING",
      up: "Up",
      down: "Down",
      priceToBeat: "Price to beat",
      averageSoFar: "Average so far",
      anchorShort: "open",
      averageShort: "avg",
      spot: "spot",
      chartOpen: "open",
      chartNow: "now",
      chartClose: "close",
      notStarted: "This window hasn't opened yet",
      loadingPrices: "loading prices…",
      tooLate: "This window closes in a few seconds — too late to place. The next one is already open.",
      nextOpens: "Next window opens in about {time} min.",
      volume: "vol",
      opensIn: "UNTIL OPEN",
      finalResult: "final result",
      resolvedUp: "Up ✓",
      resolvedDown: "Down ✓",
      resolvedTag: "resolved",
      nextTag: "next window",
      currentPrice: "Current price",
      live: "live",
      seeNext: "See the next window",
      upWon: "Up won",
      downWon: "Down won",
      otherMarkets: "Other coins",
      recent: "RECENT RESULTS",
    },

    bet: {
      sheetLabel: "Place bet",
      yes: "YES",
      no: "NO",
      stake: "STAKE",
      customStakeLabel: "Custom stake in dollars",
      customStakePlaceholder: "Custom amount",
      payoutIfCorrect: "Payout if correct",
      shares: "shares",
      /** Sits between the share count and the price. */
      at: "@",
      balance: "Balance",
      insufficient: "That's more than your balance. Lower the stake, or deposit first.",
      placing: "Placing…",
      /** `side` is the localised YES/NO label; the amount follows as its own span. */
      place: "Place {side} bet",
      signedOnChain: "SIGNED ON-CHAIN · NON-REVERSIBLE",
      sessionExpired: "Your session expired. Sign in again to place bets.",
      failed: "That bet didn't go through. Check Positions before trying again.",
    },

    receipt: {
      title: "Bet placed",
      subtitle: "Receipt settled to chain",
      header: "ODDZY RECEIPT",
      side: "Side",
      stake: "Stake",
      price: "Price",
      shares: "Shares",
      payout: "Payout if correct",
      resolves: "Resolves",
      txHash: "TX HASH",
      confirming: "Confirming on-chain — appears in Positions shortly.",
      viewPosition: "View position",
      nextMarket: "Next market",
    },

    positions: {
      title: "Positions",
      loading: "Loading…",
      openValue: "OPEN VALUE",
      unrealized: "UNREALIZED P&L",
      tabOpen: "open",
      tabSettled: "settled",
      emptyOpen: "No open positions yet.",
      shares: "shares",
      cost: "cost",
      worth: "worth",
      viewAdd: "View · Add",
      claimWinnings: "Claim winnings",
      reduceClose: "Reduce · Close",
      filterAll: "All",
      filterWon: "Won",
      filterLost: "Lost",
      sortRecent: "🕑 Recent",
      sortBiggest: "💰 Biggest",
      emptySettled: "No settled bets match this filter.",
      settledCount: "{n} settled",
      net: "net",
      staked: "staked",
      closeSheetLabel: "Close position",
      reduceTitle: "Reduce position",
      all: "All",
      pctChip: "{p}%",
      redeemsFor: "Redeems for",
      sellApprox: "Sell {shares} shares ≈",
      estimateNote:
        "Estimated at the current price. Your real fill is quoted when you confirm, and can differ on a thin book.",
      closeError: "Couldn't close that position. Nothing changed — try again shortly.",
      processing: "Processing…",
      /** Followed by the amount as its own span. */
      claim: "Claim",
      sellAll: "Sell all",
      sellPct: "Sell {p}%",
    },

    wallet: {
      title: "Wallet",
      availableBalance: "AVAILABLE BALANCE",
      custody: "USDC on Polygon · self-custodial via Privy",
      deposit: "Deposit",
      withdraw: "Withdraw",
      accounts: "YOUR ON-CHAIN ADDRESSES",
      accountsShow: "Show",
      accountsHide: "Hide",
      accountsWarning:
        "Never send funds to these addresses. They're here so you can look your account up on-chain — nothing more. To add money, use the Deposit button: it gives you the right address for the network you're sending from, and these two aren't it.",
      polymarketLabel: "🟣 POLYMARKET ACCOUNT · POLYGON",
      polymarketSub:
        "Your Polymarket account — where your balance and open positions live.",
      viewOnPolymarket: "View on Polymarket ↗",
      privyLabel: "🔑 PRIVY WALLET · SIGNER",
      privySub:
        "Your signing wallet. It never holds your balance, and anything sent here is not credited to your account.",
      /** Followed by the amount as its own span. */
      sent: "Sent",
      confirming: "Confirming on-chain",
      dismiss: "Dismiss",
      copy: "Copy",
      copied: "Copied",
      depositTitle: "Add money",
      depositNetwork: "Polygon network only",
      qrAlt: "QR code for deposit address {address}",
      copyAddress: "Copy address",
      depositWarning:
        "Send on the selected network only. Another network or another token means the funds are gone for good — no one can reverse it. Your balance updates the moment the transfer confirms.",
      /**
       * Polygon-specific, and the contract address is not decoration.
       * Polygon has two tokens called USDC; only the bridged one credits, and
       * native USDC is what most exchanges send by default.
       */
      depositWarningPolygon:
        "USDC.e only — contract 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174. Polygon also has a second, different token called USDC (0x3c499c54…): it will NOT be credited. Check the contract address before you send, or use another network above and we'll convert it for you.",
      depositWarningVault:
        "Send on the selected network only. A transfer on any other network cannot be recovered by anyone. Your balance updates automatically once it lands — usually a couple of minutes.",
      /**
       * Copy per funding rail, keyed by the `id` GET /webapp/v1/deposit returns.
       * The vault rails (56/8453/42161) take ANY token on that chain and swap it
       * for you; the bridge and Polygon rails do not, and their copy has to say
       * so — a user who sends USDT to a USDC-only address loses it.
       */
      rails: {
        "56": {
          title: "BNB Chain",
          blurb: "Send USDT or any major token on BNB Chain (BEP20). It converts automatically.",
        },
        "8453": {
          title: "Base",
          blurb: "Send USDC or any major token on Base. It converts automatically.",
        },
        "42161": {
          title: "Arbitrum",
          blurb: "Send USDC or any major token on Arbitrum. It converts automatically.",
        },
        polygon: {
          title: "Polygon",
          blurb: "Send USDC.e (0x2791…) straight to your account address. Not native USDC.",
        },
        evm: {
          title: "Ethereum & EVM",
          blurb: "Send USDC on Ethereum, Arbitrum, Base or Optimism. Bridged for you.",
        },
        svm: {
          title: "Solana",
          blurb: "Send USDC on Solana. Bridged for you.",
        },
        btc: {
          title: "Bitcoin",
          blurb: "Send BTC. Converted and bridged for you.",
        },
        tron: {
          title: "Tron",
          blurb: "Send USDT on Tron (TRC20). Converted and bridged for you.",
        },
      },
    },

    withdraw: {
      sheetLabel: "Withdraw",
      title: "Withdraw",
      /** Wraps the balance: "Available {amount} · USDC on Polygon". */
      available: "Available",
      onPolygon: "· USDC on Polygon",
      toAddress: "TO ADDRESS",
      addressPlaceholder: "0x…",
      amountLabel: "AMOUNT (USDC)",
      amountPlaceholder: "0.00",
      max: "MAX",
      pctChip: "{p}%",
      tooMuch: "That's more than your available balance.",
      positive: "Enter an amount greater than zero.",
      review: "Review",
      confirmTitle: "Confirm withdrawal",
      amount: "Amount",
      to: "TO",
      note: "Sends on Polygon. On-chain transfers cannot be reversed — check the address.",
      failed: "The withdrawal failed. Nothing was sent.",
      sending: "Sending…",
      /** Followed by the amount as its own span. */
      send: "Send",
      back: "Back",
    },

    login: {
      signIn: "Sign in",
      signOut: "Sign out",
      openTelegram: "Open in Telegram",
      loading: "Loading…",
      title: "Back the outcome you see coming",
      lead: "Sign in to start. The wallet is yours from the first second — we never hold your funds, and you can export the keys whenever you want.",
      methods: "TELEGRAM · GOOGLE · WALLET",
      tryAgain: "Try again",
      creatingWallet: "Creating your wallet…",
      authorizing: "Authorizing trading…",
      settingUp: "Setting up your account…",
      walletTimeout:
        "Your wallet didn't finish loading. This is usually a desktop browser issue — try again on mobile or in Chrome.",
      setupFailed: "Couldn't finish setting up your wallet. ({detail})",
    },

    errors: {
      telegramSession: "We couldn't verify your Telegram session. Reopen Oddzy from the bot.",
      openTelegram: "Open in Telegram",
      signInPrompt: "Sign in to see your wallet and positions.",
      noWallet: "You don't have a wallet yet.",
      setUpWallet: "Set up your wallet",
      blocked: "This account can't access Oddzy.",
      rateLimited: "Too many requests — give it a minute.",
      unavailable: "Couldn't reach the server. Try again shortly.",
    },
  },
};

/**
 * Deliberately NOT `as const`: with literal types, `Dict` would demand the exact
 * English string at every key and no translation could ever satisfy it. Widened
 * to `string`, the type still enforces the full key structure — a missing or
 * misspelled key in `fa.ts` is a compile error, which is the guarantee we want.
 */
export type Dict = typeof en;
