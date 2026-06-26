// js/content/crimes/scam.js – Online Scam Crime
// Digital fraud with a delayed trace (up to 4 days later).

import { rand, hasItem } from '../../core/state.js';

export const scamCrime = {
  id: 'scam',
  type: 'crime',
  name: 'Online Scam',
  desc: 'Digital fraud. May get traced up to 3 days later.',
  icon: '💻',
  reward: [100, 300],
  failChance: 0.35,
  energyCost: 20,
  xpGain: 10,
  jailRisk: 0.7,
  fine: [150, 500],
  jailTime: [2, 5],
  duration: 3.5,
  needItem: 'laptop',
  healthRisk: 0,
  delayed: true, // triggers a trace event later
  cooldown: 4,

  /**
   * Custom execution for scam.
   * Success => reward and schedule a delayed trace.
   * Failure => immediate fine/jail.
   */
  execute(crime) {
    const isFail = Math.random() < crime.failChance;

    if (isFail) {
      const caught = Math.random() < crime.jailRisk;
      const fine = Math.floor(rand(crime.fine[0], crime.fine[1]));
      return {
        success: false,
        caught: caught,
        fine: fine,
        jailDays: caught ? Math.floor(rand(crime.jailTime[0], crime.jailTime[1])) : 0,
        xpGain: 2,
        message: caught ? 'Caught' : 'Failed',
      };
    } else {
      const reward = Math.floor(rand(crime.reward[0], crime.reward[1]));
      // Schedule delayed trace (2-4 days from now)
      // We'll set a flag in G that the time system will check.
      // We'll use G._pendingScamTrace = day + delay
      const delay = Math.floor(rand(2, 4));
      // We'll import the function to set this flag from time.js, but we can just set it directly.
      // We'll need to ensure time.js checks G._pendingScamTrace.
      // To avoid circular, we'll set it on G.
      G._pendingScamTrace = G.day + delay;
      // Also record that we did a scam
      G._scamCommitted = true;
      return {
        success: true,
        reward: reward,
        xpGain: crime.xpGain,
        message: 'Success (trace in ' + delay + ' days)',
        delayed: true,
      };
    }
  },
};