// js/content/crimes/pickpocket.js – Pickpocket Crime
// A low-level street crime with moderate risk.

import { rand, hasItem } from '../../core/state.js';

export const pickpocketCrime = {
  id: 'pickpocket',
  type: 'crime',
  name: 'Pickpocket',
  desc: 'Steal a wallet from a crowd. Risk increases without a suit.',
  icon: '👜',
  reward: [15, 40],
  failChance: 0.20,
  energyCost: 15,
  xpGain: 3,
  jailRisk: 0.3,
  fine: [20, 60],
  jailTime: [1, 3],
  duration: 1.5,
  needItem: null,
  healthRisk: 0,
  delayed: false,
  cooldown: 2,

  /**
   * Custom execution for pickpocket.
   * Wearing a suit reduces fail chance.
   */
  execute(crime) {
    // Suit reduces fail chance
    let failChance = crime.failChance;
    if (hasItem('suit')) {
      failChance = Math.max(0.05, failChance - 0.10);
    }

    const isFail = Math.random() < failChance;

    if (isFail) {
      const caught = Math.random() < crime.jailRisk;
      const fine = Math.floor(rand(crime.fine[0], crime.fine[1]));
      // Fine deducted by the caller's default logic, but we return the values
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
      return {
        success: true,
        reward: reward,
        xpGain: crime.xpGain,
        message: 'Success',
      };
    }
  },
};