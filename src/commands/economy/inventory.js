const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../db');
const { SHOP_ITEMS } = require('../../utils/economyItems');
const { fixedEmbed } = require('../../utils/embedUtils');
const FISHING_DATA = require('../../data/fishing.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Access your items, fish collection, and equipment'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // --- PAGE GENERATORS ---

    const getMainMenu = () => {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎒 Your Personal Inventory')
        .setDescription('Choose a category to manage your assets.')
        .addFields(
          { name: '📦 Items', value: 'Collectibles & Luxury', inline: true },
          { name: '🧪 Potions', value: 'Temporary Boosts', inline: true },
          { name: '🍱 Baits', value: 'Fishing Lures', inline: true },
          { name: '🐟 Fish Bucket', value: 'Caught Collection', inline: true },
          { name: '🎣 Fishing Gear', value: 'Rod Maintenance', inline: true }
        )
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId('inv_category')
        .setPlaceholder('Select a category...')
        .addOptions([
          { label: 'General Items', value: 'page_items', emoji: '📦' },
          { label: 'Potions & Boosts', value: 'page_potions', emoji: '🧪' },
          { label: 'Baits', value: 'page_baits', emoji: '🍱' },
          { label: 'Fish Bucket', value: 'page_fish', emoji: '🐟' },
          { label: 'Fishing Gear', value: 'page_rods', emoji: '🎣' }
        ]);

      return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
    };

    const getItemsPage = async (data) => {
      const inventory = data.inventory || [];
      const itemCounts = {};
      const excluded = ['lucky_potion', 'coffee', 'cookie', 'bait_legends'];

      inventory.forEach(id => {
        if (id.startsWith('rod_') || excluded.includes(id)) return;
        itemCounts[id] = (itemCounts[id] || 0) + 1;
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📦 Luxury Items')
        .setTimestamp();

      if (Object.keys(itemCounts).length === 0) {
        embed.setDescription('Your inventory of luxury items is empty!');
      } else {
        const list = Object.entries(itemCounts).map(([id, count]) => {
          const item = SHOP_ITEMS.find(i => i.id === id);
          return `**${item?.name || id}** — x${count}\n*${item?.description || ''}*`;
        }).join('\n\n');
        embed.setDescription(list);
      }

      const backBtn = new ButtonBuilder().setCustomId('back_to_menu').setLabel('Back').setStyle(ButtonStyle.Secondary);
      return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn)] };
    };

    const getPotionsPage = async (data, selectedId = null) => {
      const inventory = data.inventory || [];
      const potionIds = ['lucky_potion', 'coffee'];
      const ownedPotions = [...new Set(inventory.filter(id => potionIds.includes(id)))];
      
      const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('🧪 Potions').setTimestamp();
      const now = Date.now();
      const activeEffects = [];
      if ((data.luckyBoostUntil || 0) > now) activeEffects.push(`🧪 **Luck Boost:** ${Math.ceil((data.luckyBoostUntil - now) / 60000)}m left`);
      if ((data.coffeeFishingUntil || 0) > now) activeEffects.push(`☕ **Fishing Haste:** ${Math.ceil((data.coffeeFishingUntil - now) / 60000)}m left`);

      if (activeEffects.length > 0) embed.addFields({ name: 'Active Effects', value: activeEffects.join('\n') });

      if (ownedPotions.length === 0) {
        embed.setDescription('No potions owned.');
      } else {
        let list = '';
        ownedPotions.forEach(id => {
          const item = SHOP_ITEMS.find(i => i.id === id);
          const count = inventory.filter(x => x === id).length;
          list += `**${item?.name || id}** (x${count}) ${id === selectedId ? '⬅️' : ''}\n*${item?.description || ''}*\n\n`;
        });
        embed.setDescription(list);
      }

      const row1 = new ActionRowBuilder();
      const row2 = new ActionRowBuilder();
      if (ownedPotions.length > 0) {
        row1.addComponents(new StringSelectMenuBuilder().setCustomId('potion_select_inner').addOptions(ownedPotions.map(id => ({ label: SHOP_ITEMS.find(i => i.id === id)?.name || id, value: id, default: id === selectedId }))));
        row2.addComponents(new ButtonBuilder().setCustomId('use_potion_inner').setLabel('Use Potion').setStyle(ButtonStyle.Success).setDisabled(!selectedId));
      }
      row2.addComponents(new ButtonBuilder().setCustomId('back_to_menu').setLabel('Back').setStyle(ButtonStyle.Secondary));
      return { embeds: [embed], components: row1.components.length > 0 ? [row1, row2] : [row2] };
    };

    const getBaitsPage = async (data, selectedId = null) => {
      const baitUses = data.baitUses || {};
      const equippedBait = data.equippedBait;
      const ownedBaits = Object.keys(baitUses).filter(id => baitUses[id] > 0);

      const embed = new EmbedBuilder().setColor(0xE91E63).setTitle('🍱 Fishing Baits').setTimestamp();
      
      if (ownedBaits.length === 0) {
        embed.setDescription('No bait available.');
      } else {
        let list = '';
        ownedBaits.forEach(id => {
          const item = SHOP_ITEMS.find(i => i.id === id);
          const uses = baitUses[id];
          const isEquipped = id === equippedBait;
          list += `${isEquipped ? '✅' : '❌'} **${item?.name || id}**: ${uses} uses left ${id === selectedId ? '⬅️' : ''}\n`;
        });
        embed.setDescription(list);
      }

      const row1 = new ActionRowBuilder();
      const row2 = new ActionRowBuilder();
      if (ownedBaits.length > 0) {
        row1.addComponents(new StringSelectMenuBuilder().setCustomId('bait_select_inner').addOptions(ownedBaits.map(id => ({ label: SHOP_ITEMS.find(i => i.id === id)?.name || id, value: id, default: id === selectedId }))));
        row2.addComponents(new ButtonBuilder().setCustomId('equip_bait_inner').setLabel('Equip').setStyle(ButtonStyle.Success).setDisabled(!selectedId || selectedId === equippedBait));
        row2.addComponents(new ButtonBuilder().setCustomId('unequip_bait_inner').setLabel('Unequip').setStyle(ButtonStyle.Secondary).setDisabled(!equippedBait || (selectedId && selectedId !== equippedBait)));
      }
      row2.addComponents(new ButtonBuilder().setCustomId('back_to_menu').setLabel('Back').setStyle(ButtonStyle.Secondary));
      return { embeds: [embed], components: row1.components.length > 0 ? [row1, row2] : [row2] };
    };

    const getFishPage = async (data) => {
      const fishInv = data.fishInventory || [];
      const embed = new EmbedBuilder().setColor(0x1F8B4C).setTitle('🐟 Fish Bucket').setTimestamp();
      if (fishInv.length === 0) {
        embed.setDescription('Your bucket is empty!');
      } else {
        const counts = {};
        fishInv.forEach(id => counts[id] = (counts[id] || 0) + 1);
        let list = '';
        Object.keys(counts).forEach(id => {
          const fish = FISHING_DATA.fishes.find(f => f.id === parseInt(id));
          if (fish) list += `**${fish.name}** (${fish.rarity}) x${counts[id]} — *$${fish.price.toLocaleString()}*\n`;
        });
        embed.setDescription(`**Total:** ${fishInv.length} fish\n\n${list}`);
      }
      const backBtn = new ButtonBuilder().setCustomId('back_to_menu').setLabel('Back').setStyle(ButtonStyle.Secondary);
      return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn)] };
    };

    const getRodsPage = async (data) => {
      const rodDurabilityMap = data.rodDurability || {};
      const rodId = 'rod_standard';
      const dur = rodDurabilityMap[rodId] || 0;
      const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('🎣 Fishing Gear').setTimestamp();
      if (dur <= 0) {
        embed.setDescription('You have no functional rod. Buy the Standard Rod at `/shop`.');
      } else {
        embed.setDescription(`✅ **Standard Fishing Rod**\n🛠️ Durability: **${dur}/${FISHING_DATA.equipment.rod.max_durability}**\n\n*Rod costs $400/use based on its purchase price.*`);
      }
      const backBtn = new ButtonBuilder().setCustomId('back_to_menu').setLabel('Back').setStyle(ButtonStyle.Secondary);
      return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn)] };
    };

    // --- LOGIC ---
    const response = await interaction.editReply(getMainMenu());
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.MessageComponent, time: 300000 });
    let currentSelectedId = null;

    collector.on('collect', async i => {
      if (i.user.id !== userId) return i.reply({ content: 'Not for you!', ephemeral: true });
      const data = await db.getEconomy(guildId, userId);

      if (i.customId === 'inv_category') {
        currentSelectedId = null;
        if (i.values[0] === 'page_items') await i.update(await getItemsPage(data));
        else if (i.values[0] === 'page_potions') await i.update(await getPotionsPage(data));
        else if (i.values[0] === 'page_baits') await i.update(await getBaitsPage(data));
        else if (i.values[0] === 'page_fish') await i.update(await getFishPage(data));
        else if (i.values[0] === 'page_rods') await i.update(await getRodsPage(data));
      } else if (i.customId === 'back_to_menu') {
        currentSelectedId = null;
        await i.update(getMainMenu());
      } else if (i.customId === 'potion_select_inner') {
        currentSelectedId = i.values[0];
        await i.update(await getPotionsPage(data, currentSelectedId));
      } else if (i.customId === 'use_potion_inner') {
        const inventory = data.inventory || [];
        let removed = false;
        const newInv = inventory.filter(id => { if (!removed && id === currentSelectedId) { removed = true; return false; } return true; });
        const now = Date.now();
        const BOOST_30 = 30 * 60 * 1000;
        const BOOST_15 = 15 * 60 * 1000;
        let updates = { inventory: newInv };
        if (currentSelectedId === 'lucky_potion') updates.luckyBoostUntil = Math.max(now, data.luckyBoostUntil || 0) + BOOST_15;
        else if (currentSelectedId === 'coffee') updates.coffeeFishingUntil = Math.max(now, data.coffeeFishingUntil || 0) + BOOST_30;
        await db.updateEconomy(guildId, userId, updates);
        const up = await db.getEconomy(guildId, userId);
        await i.reply({ content: '✅ Boost activated!', ephemeral: true });
        await interaction.editReply(await getPotionsPage(up, currentSelectedId));
      } else if (i.customId === 'bait_select_inner') {
        currentSelectedId = i.values[0];
        await i.update(await getBaitsPage(data, currentSelectedId));
      } else if (i.customId === 'equip_bait_inner') {
        await db.updateEconomy(guildId, userId, { equippedBait: currentSelectedId });
        const up = await db.getEconomy(guildId, userId);
        await i.update(await getBaitsPage(up, currentSelectedId));
      } else if (i.customId === 'unequip_bait_inner') {
        await db.updateEconomy(guildId, userId, { equippedBait: null });
        const up = await db.getEconomy(guildId, userId);
        await i.update(await getBaitsPage(up, currentSelectedId));
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
