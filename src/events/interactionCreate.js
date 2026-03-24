module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Slash Commands (termasuk semua subcommands) ──
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`❌ Error in /${interaction.commandName}:`, err);
        const msg = { content: '❌ An error occurred while running this command!', ephemeral: true };
        try {
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
          else await interaction.reply(msg);
        } catch {}
      }
    }
  },
};
