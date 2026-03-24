const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('📢 Kirim pesan sebagai bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt
        .setName('message')
        .setDescription('Pesan yang akan dikirim')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel tujuan (default: channel saat ini)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    // Pastikan channel bisa dikirim pesan
    if (!channel.isTextBased()) {
      return interaction.reply({ content: '❌ Channel tersebut bukan text channel!', ephemeral: true });
    }

    try {
      await channel.send(message);
      // Delete the slash command interaction tanpa reply agar tidak ada jejak
      await interaction.reply({ content: '✅', ephemeral: true });
      await interaction.deleteReply();
    } catch (err) {
      return interaction.reply({ content: `❌ Gagal mengirim pesan: ${err.message}`, ephemeral: true });
    }
  },
};
