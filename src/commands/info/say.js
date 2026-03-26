const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('📢 Send a message as the bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message to send').setRequired(true).setMinLength(1).setMaxLength(2000)
    )
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Destination channel (default: current channel)').setRequired(false)
    ),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    if (!channel.isTextBased()) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ That channel is not a text channel.')],
        ephemeral: true,
      });
    }

    try {
      await channel.send(message);
      await interaction.reply({ content: '✅', ephemeral: true });
      await interaction.deleteReply().catch(() => {});
    } catch (err) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Failed to send message: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
