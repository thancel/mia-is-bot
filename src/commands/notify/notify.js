const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const { buildEmbed } = require('../../utils/anilist'); // from previous anime search logic

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Configure notifications for various services')
    .addSubcommandGroup(group => group
      .setName('anime')
      .setDescription('AniList anime release notifications')
      .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('Set up anime release notifications from an AniList user')
        .addChannelOption(opt => opt
          .setName('channel')
          .setDescription('The channel to send notifications to')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true))
        .addStringOption(opt => opt
          .setName('username')
          .setDescription('AniList username to track (defaults to "cel")')
          .setRequired(false))
        .addRoleOption(opt => opt
          .setName('role')
          .setDescription('Role to ping when an episode airs')
          .setRequired(false))
      )
      .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('Disable anime release notifications in this server')
      )
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: fixedEmbed(0xED4245, '❌ **Admin Only:** You do not have the required permissions.'),
        flags: MessageFlags.Ephemeral,
      });
    }

    const group = interaction.options.getSubcommandGroup();
    const sub   = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (group === 'anime') {
      if (sub === 'setup') {
        const channel  = interaction.options.getChannel('channel');
        const role     = interaction.options.getRole('role');
        const username = interaction.options.getString('username') || 'cel';

        await db.setGuildConfig(guildId, {
          animeNotifChannelId: channel.id,
          animeNotifRoleId: role ? role.id : null,
          animeNotifUsername: username,
        });

        // Test the username right away
        let validUser = true;
        try {
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              query: `query($name: String){ User(name: $name){ id name } }`,
              variables: { name: username }
            })
          });
          const json = await res.json();
          if (json.errors || !json.data.User) validUser = false;
        } catch (_) { validUser = false; }

        if (!validUser) {
          return interaction.reply({
            embeds: fixedEmbed(0xffa500, `⚠️ **Warning:** The AniList user **${username}** was not found.\nThe configuration was saved, but notifications won't work until a valid username is provided.`),
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Anime Notifications Enabled!')
            .setDescription(`Episodes from **${username}**'s watching list will be posted in <#${channel.id}>.`)
            .addFields(
              { name: 'Channel', value: `<#${channel.id}>`, inline: true },
              { name: 'Ping',    value: role ? `<@&${role.id}>` : 'None', inline: true },
              { name: 'AniList', value: `[${username}](https://anilist.co/user/${username})`, inline: true }
            )
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'remove') {
        await db.setGuildConfig(guildId, {
          animeNotifChannelId: null,
          animeNotifRoleId: null,
          animeNotifUsername: null,
        });
        return interaction.reply({
          embeds: fixedEmbed(0x57F287, '✅ Anime release notifications have been **disabled**.'),
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
