const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const { SHOP_ITEMS } = require('../../utils/economyItems');

const processingUsers = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🛒 Browse and buy items from the economy shop'),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const categories = ['General', 'ATM Upgrades', 'Fishing Gear'];
    let categoryIdx = 0;

    const getItems = (idx) => {
      if (idx === 0) return SHOP_ITEMS.filter(i => !i.id.startsWith('atm_') && i.category !== 'Fishing' && i.id !== 'atm_card');
      if (idx === 1) return SHOP_ITEMS.filter(i => i.id.startsWith('atm_'));
      if (idx === 2) return SHOP_ITEMS.filter(i => i.category === 'Fishing');
      return [];
    };

    const generateEmbed = (idx) => {
      const cat = categories[idx];
      const itemsToShow = getItems(idx);

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🛒 Shop — ${cat}`)
        .setFooter({ text: `Page ${idx + 1} of ${categories.length}` })
        .setTimestamp();

      let desc = '';
      itemsToShow.forEach(item => {
        desc += `**${item.name}** — $${item.price.toLocaleString()}\n*${item.description}*\n\n`;
      });
      embed.setDescription(desc || 'No items currently available in this category.');

      return embed;
    };

    const generateComponents = (idx, data = {}, selectedItem = null) => {
      const cat = categories[idx];
      let itemsToShow = getItems(idx);

      const inventory = data.inventory || [];
      const rodDurability = data.rodDurability || {};
      const atmTier = data.atmTier;
      const atmOrder = [null, 'atm_basic', 'atm_gold', 'atm_platinum', 'atm_black'];

      itemsToShow = itemsToShow.filter(it => {
        if (it.id.startsWith('atm_')) {
          const currentIdx = atmOrder.indexOf(atmTier);
          const targetIdx = atmOrder.indexOf(it.id);
          return targetIdx === currentIdx + 1;
        }
        if (it.id === 'rod_standard') {
          const currentDur = rodDurability[it.id] || 0;
          return currentDur <= 0;
        }
        // Allow bait stacking
        if (it.id.startsWith('bait_')) return true;

        return it.stackable || !inventory.includes(it.id);
      });

      const row1 = new ActionRowBuilder();
      if (itemsToShow.length > 0) {
        row1.addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('buy_select')
            .setPlaceholder(`Select from ${cat}...`)
            .addOptions(itemsToShow.map(item => ({
              label: `${item.name} ($${item.price.toLocaleString()})`,
              value: item.id,
              default: item.id === selectedItem?.id
            })))
        );
      } else {
        row1.addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('buy_select_disabled')
            .setPlaceholder('Category empty/complete.')
            .addOptions({ label: 'None', value: 'none' })
            .setDisabled(true)
        );
      }

      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('prev_cat').setLabel('⬅️ Previous').setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
          new ButtonBuilder().setCustomId('next_cat').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(idx === categories.length - 1)
        );

      const actionRow = new ActionRowBuilder();
      if (selectedItem) {
        // Only stackable non-fishing items get the Amount button
        const isStackableGeneral = selectedItem.stackable && !selectedItem.category && !selectedItem.id.startsWith('atm_');
        
        if (isStackableGeneral) {
          actionRow.addComponents(
            new ButtonBuilder().setCustomId(`buy_confirm:${selectedItem.id}`).setLabel(`Confirm Buy (1x)`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`buy_amount:${selectedItem.id}`).setLabel(`Buy (Amount)`).setStyle(ButtonStyle.Secondary)
          );
        } else {
          actionRow.addComponents(
            new ButtonBuilder().setCustomId(`buy_confirm:${selectedItem.id}`).setLabel(`Confirm Buy (1x)`).setStyle(ButtonStyle.Success)
          );
        }
      }

      return actionRow.components.length > 0 ? [row1, buttons, actionRow] : [row1, buttons];
    };

    const initialData = await db.getEconomy(guildId, interaction.user.id);
    const response = await interaction.reply({
      embeds: [generateEmbed(categoryIdx)],
      components: generateComponents(categoryIdx, initialData)
    });

    const collector = response.createMessageComponentCollector({ time: 600000 });
    let currentSelectedItem = null;

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not for you!', ephemeral: true });
      const currentData = await db.getEconomy(guildId, i.user.id);

      if (i.customId === 'prev_cat') {
        categoryIdx--; currentSelectedItem = null;
        await i.update({ embeds: [generateEmbed(categoryIdx)], components: generateComponents(categoryIdx, currentData) });
      } else if (i.customId === 'next_cat') {
        categoryIdx++; currentSelectedItem = null;
        await i.update({ embeds: [generateEmbed(categoryIdx)], components: generateComponents(categoryIdx, currentData) });
      } else if (i.customId === 'buy_select') {
        currentSelectedItem = SHOP_ITEMS.find(it => it.id === i.values[0]);
        await i.update({ components: generateComponents(categoryIdx, currentData, currentSelectedItem) });
      } else if (i.customId.startsWith('buy_amount:')) {
        const itemId = i.customId.split(':')[1];
        const modal = new ModalBuilder().setCustomId(`modal_buy:${itemId}:${Date.now()}`).setTitle(`Buy ${currentSelectedItem.name}`);
        const amountInput = new TextInputBuilder().setCustomId('amount').setLabel('Quantity (1-99)').setStyle(TextInputStyle.Short).setPlaceholder('Enter amount').setRequired(true).setMaxLength(2).setMinLength(1);
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await i.showModal(modal);

        try {
          const submitted = await i.awaitModalSubmit({ time: 60000, filter: m => m.customId.startsWith('modal_buy:') && m.user.id === i.user.id });
          if (submitted) {
            const qty = parseInt(submitted.fields.getTextInputValue('amount'));
            if (isNaN(qty) || qty <= 0 || qty > 99) return submitted.reply({ content: '❌ Invalid amount.', ephemeral: true });
            await processPurchase(submitted, itemId, qty);
          }
        } catch (err) {}
      } else if (i.customId.startsWith('buy_confirm:')) {
        await processPurchase(i, i.customId.split(':')[1], 1);
      }
    });

    async function processPurchase(intr, itemId, quantity) {
      if (processingUsers.has(intr.user.id)) return intr.reply({ content: '⏳ Busy...', ephemeral: true });
      processingUsers.add(intr.user.id);

      const item = SHOP_ITEMS.find(it => it.id === itemId);
      const data = await db.getEconomy(guildId, intr.user.id);
      const totalCost = item.price * quantity;

      if (data.balance < totalCost) {
        processingUsers.delete(intr.user.id);
        return intr.reply({ content: `❌ Need **$${totalCost.toLocaleString()}**!`, ephemeral: true });
      }

      try {
        let updates = { balance: data.balance - totalCost };
        
        if (itemId.startsWith('atm_')) {
          updates.atmTier = itemId;
        } else if (itemId.startsWith('rod_')) {
          const fishingData = require('../../data/fishing.json');
          updates.rodDurability = { ...data.rodDurability, [itemId]: fishingData.equipment.rod.max_durability };
          updates.equippedRod = itemId;
        } else if (itemId.startsWith('bait_')) {
          const fishingData = require('../../data/fishing.json');
          const baitInfo = fishingData.equipment.baits.find(b => b.id === itemId);
          const packUses = baitInfo.max_uses * quantity;
          const currentUses = (data.baitUses || {})[itemId] || 0;
          updates.baitUses = { ...data.baitUses, [itemId]: currentUses + packUses };
          if (!data.equippedBait) updates.equippedBait = itemId;
        } else {
          updates.inventory = [...(data.inventory || []), ...Array(quantity).fill(itemId)];
        }

        await db.updateEconomy(guildId, intr.user.id, updates);
        await intr.reply({ content: `✅ Bought **${quantity}x ${item.name}**!`, ephemeral: true });
        const freshData = await db.getEconomy(guildId, intr.user.id);
        await interaction.editReply({ embeds: [generateEmbed(categoryIdx)], components: generateComponents(categoryIdx, freshData) });
      } catch (err) {
        console.error(err);
      } finally {
        processingUsers.delete(intr.user.id);
      }
    }

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
