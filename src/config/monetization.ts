// Monetization switches and IDs. Everything is OFF until you turn it on and add your IDs.
// README → "Monetization" explains where each value comes from.

export const MONETIZATION = {
  ads: {
    /** Show ads in the apps (AdMob) and on the website (AdSense). Pro users never see ads. */
    enabled: false,
    admob: {
      /** AdMob → Apps → App settings → App ID (ca-app-pub-…~…). Needed to build the app with ads. */
      androidAppId: '',
      iosAppId: '',
      /** Ad unit IDs (ca-app-pub-…/…). In development Google's test ads are always used instead. */
      android: { banner: '', native: '', interstitial: '', rewarded: '' },
      ios: { banner: '', native: '', interstitial: '', rewarded: '' },
    },
    adsense: {
      /** Publisher ID. Also verifies the site with AdSense (meta tag + ads.txt), even while ads are off. */
      client: 'ca-pub-7800926982608293',
      /** Ad unit (slot) IDs from AdSense → Ads → By ad unit. */
      slots: { inList: '', belowList: '', sidebar: '' },
    },
    /** A native ad (app) / in-list ad (website) after every this many jobs. */
    listAdEvery: 7,
    /** Full-screen ads: at most one every this many minutes, never on app open. */
    interstitialMinMinutes: 4,
    /** No full-screen ad in the first this many seconds after the app opens. */
    interstitialGraceSeconds: 90,
  },

  pro: {
    /** Show the Pro subscription (paywall, limits, Pro-only tools). */
    enabled: false,
    /** Shown prices (₹). The real price is whatever you set in Play Console / App Store / Razorpay. */
    prices: { monthly: 49, yearly: 299 },
    revenueCat: {
      /** RevenueCat → Project → API keys → public app-specific keys. */
      androidApiKey: '',
      iosApiKey: '',
      /** Entitlement identifier you create in RevenueCat. */
      entitlement: 'pro',
    },
    /**
     * Website payments with Razorpay. Keys and plan IDs are set in Cloudflare (README → Pro), never here:
     * RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_MONTHLY_PLAN_ID, RAZORPAY_YEARLY_PLAN_ID.
     */
    razorpay: { enabled: true },
    /** Free users get new-job alerts this many minutes after Pro users ("instant priority alerts"). */
    freeAlertDelayMinutes: 30,
  },

  /** Limits for free users when Pro is enabled (Pro = unlimited). */
  freeLimits: { savedJobs: 10, reminders: 5 },

  /** Watch a rewarded ad to use the Pro tools free for this many hours (apps only). */
  rewardedUnlockHours: 24,

  /** "Recommended books" (affiliate) and "Sponsored" coaching cards, managed in the admin panel. */
  affiliate: { enabled: true },
  sponsored: { enabled: true },

  /** Your public channels (empty = button hidden). */
  community: {
    telegramUrl: 'https://t.me/govtjobsfinders',
    whatsappUrl: '',
  },

  /** Firebase Analytics (apps) and Google Analytics 4 (website). */
  analytics: {
    enabled: false,
    /** GA4 measurement ID for the website, e.g. "G-XXXXXXXXXX" (Firebase → Project settings → your web app). */
    webMeasurementId: '',
  },

  /** Mock tests and daily quiz (phase 2 scaffold). */
  quiz: { enabled: true, dailyQuestions: 10 },
};
