require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const QuickDB = require('quick.db');
const db = new QuickDB.QuickDB();

const prefix = process.env.PREFIX || '!';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// Statut du bot
client.once('ready', () => {
  console.log(`${client.user.tag} est en ligne !`);
  client.user.setActivity('tes progrès', { type: 'WATCHING' });
});

// Bienvenue
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) channel.send(`Bienvenue, ${member.user}! 🎉`);
});

// Salons vocaux temporaires
client.on('voiceStateUpdate', async (oldState, newState) => {
  const channel = newState.channel;
  if (channel && channel.name === 'Créer un salon') {
    const tempChannel = await channel.guild.channels.create({
      name: `${newState.member.user.username}-salon`,
      type: 2, // vocal
      parent: channel.parentId
    });
    await newState.member.voice.setChannel(tempChannel);
    const interval = setInterval(() => {
      if (tempChannel.members.size === 0) {
        tempChannel.delete();
        clearInterval(interval);
      }
    }, 30000);
  }
});

// Commandes
client.on('messageCreate', async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const [cmd, ...args] = message.content.slice(prefix.length).split(/ +/);

  // Ajouter modérateur (stocké dans la DB)
  if (cmd === 'addmod') {
    if (!message.member.permissions.has("Administrator")) return;
    const mention = message.mentions.users.first();
    if (!mention) return message.reply("Mentionne un utilisateur.");
    await db.set(`mod_${mention.id}`, true);
    message.channel.send(`${mention.username} est maintenant modérateur.`);
  }

  // Mini-jeu : pierre-feuille-ciseaux
  else if (cmd === 'rps') {
    const choix = ['pierre', 'feuille', 'ciseaux'];
    const user = args[0];
    if (!choix.includes(user)) return message.reply("Choisis entre pierre, feuille ou ciseaux.");
    const bot = choix[Math.floor(Math.random() * 3)];
    let result = user === bot ? "Égalité !" :
      (user === "pierre" && bot === "ciseaux") || (user === "feuille" && bot === "pierre") || (user === "ciseaux" && bot === "feuille")
      ? "Tu gagnes !" : "Tu perds !";
    message.channel.send(`Tu as joué **${user}**, j'ai joué **${bot}**. ${result}`);
  }

  // Pub
  else if (cmd === 'pub') {
    const pubChannel = message.guild.channels.cache.find(c => c.name.includes("pub"));
    if (!pubChannel) return message.reply("Aucun salon 'pub' trouvé.");
    const last = await db.get(`lastPub_${message.author.id}`);
    const now = Date.now();
    if (last && now - last < 3600000) return message.reply("Tu dois attendre 1h entre chaque pub.");
    db.set(`lastPub_${message.author.id}`, now);
    pubChannel.send(`📢 Pub de ${message.author} :\n${args.join(" ")}`);
    message.reply("Ta pub a été postée !");
  }

  // Météo
  else if (cmd === 'meteo') {
    const ville = args.join(" ") || 'Paris';
    const key = process.env.OWM_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${ville}&appid=${key}&units=metric&lang=fr`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.cod !== 200) return message.reply("Ville non trouvée.");
      const desc = data.weather[0].description;
      const temp = data.main.temp;
      message.channel.send(`🌤️ Météo à ${ville} : ${temp}°C, ${desc}`);
    } catch {
      message.reply("Erreur en récupérant la météo.");
    }
  }

  // Système de niveau
  else {
    const xp = (await db.get(`xp_${message.author.id}`)) || 0;
    const newXP = xp + 10;
    await db.set(`xp_${message.author.id}`, newXP);
    const level = Math.floor(newXP / 100);
    const oldLevel = Math.floor(xp / 100);
    if (level > oldLevel) {
      message.channel.send(`🎉 GG ${message.author}, tu passes niveau ${level} !`);
    }
  }
});

client.login(process.env.TOKEN);