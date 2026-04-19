const activeGames = new Set();

/**
 * Game session tracker to prevent multiple games in the same channel.
 */
module.exports = {
  /**
   * Check if a game is already running in a channel.
   * @param {string} channelId 
   * @returns {boolean}
   */
  isGameActive: (channelId) => activeGames.has(channelId),

  /**
   * Set a channel as having an active game.
   * @param {string} channelId 
   */
  setGameActive: (channelId) => activeGames.add(channelId),

  /**
   * Remove a channel from the active game tracker.
   * @param {string} channelId 
   */
  setGameInactive: (channelId) => activeGames.delete(channelId),
};
