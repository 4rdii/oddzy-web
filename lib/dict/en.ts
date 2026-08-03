/**
 * English copy. This is the shape every other locale must satisfy — `Dict` is
 * inferred from it, so adding a key here is a type error in `fa.ts` until it is
 * translated. Strings are kept verbatim from the pre-i18n components so the
 * English site renders byte-identically after the extraction.
 */
export const en = {
  nav: {
    howItWorks: "How it works",
    learn: "Learn",
    faq: "FAQ",
    signIn: "Sign in",
    primary: "Primary",
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
  learn: {
    metaTitle: "Learn — prediction markets explained",
    metaDescription:
      "Guides and analysis on prediction markets: how prices become probabilities, how they differ from sportsbooks, and how to trade them from Telegram.",
    h1: "Learn",
    lead: "How prediction markets work, what the prices actually mean, and how to trade them without getting the basics wrong.",
    backToAll: "← All articles",
    minRead: "MIN READ",
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
      marketCount: { one: "{n} MARKET", other: "{n} MARKETS" },
      /** Appended after the market count; carries its own separator. */
      subCount: " · {n} SUB",
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
        "Settles on-chain via Polymarket at close. Final outcome is determined by the market's oracle; where an outcome is disputed, the UMA optimistic oracle decides.",
      viewOnPolymarket: "View on Polymarket ↗",
      risk: "Prediction markets carry risk of loss. 18+. Oddzy is an interface to Polymarket — it never holds your funds.",
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
      insufficient: "Stake is more than your available balance.",
      placing: "Placing…",
      /** `side` is the localised YES/NO label; the amount follows as its own span. */
      place: "Place {side} bet",
      signedOnChain: "SIGNED ON-CHAIN · NON-REVERSIBLE",
      sessionExpired: "Your session expired. Sign in again to place bets.",
      failed: "Couldn't place that bet.",
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
        "Estimate at the current price; the fill is quoted server-side and may differ.",
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
      accounts: "YOUR ACCOUNTS",
      polymarketLabel: "🟣 POLYMARKET ACCOUNT · POLYGON",
      polymarketSub:
        "Deposit USDC on Polygon to this address. Polygon only — funds sent on another network can't be recovered.",
      viewOnPolymarket: "View on Polymarket ↗",
      privyLabel: "🔑 PRIVY WALLET · SIGNER",
      privySub:
        "⚠️ Don't deposit here — this is your signing wallet. Add funds to the Polymarket address above (or use Deposit).",
      /** Followed by the amount as its own span. */
      sent: "Sent",
      confirming: "Confirming on-chain",
      dismiss: "Dismiss",
      copy: "Copy",
      copied: "Copied",
      depositTitle: "Deposit USDC",
      depositNetwork: "Polygon network only",
      qrAlt: "QR code for deposit address {address}",
      copyAddress: "Copy address",
      depositWarning:
        "Send USDC on Polygon only. Anything sent on another network, or a different token, cannot be recovered. Funds appear here once the transfer confirms.",
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
      title: "Trade prediction markets",
      lead: "Sign in to place bets. Your wallet is yours — we never hold your funds.",
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
