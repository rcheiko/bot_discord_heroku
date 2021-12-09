const fs = require('fs');
const { Client, Collection, Intents, MessageEmbed } = require('discord.js');
const { token } = require('./config.json');
const cron = require('node-cron');


// Create a new client instance
const client = new Client({
	partials: ['CHANNEL'],
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_TYPING,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS
	]
});

const guild_id = '916313909764456448';

const rules_channel_id = '917472907851083816';
const vote_channel_id = '918137856097128458';
const farmer_role_id = '917473153117204550';
const admin_role_id = '918157118027202580';
const leaderboard_channel_id = '918137825029922898';

let guild;

let rules_channel;
let vote_channel;

let farmer_role;
let admin_role;

let db = require("./db/db.json");

setInterval(async () => {
	await fs.writeFileSync("./db/db.json", JSON.stringify(db));
}, 1000);

async function rules(){
    let message;
    let info = await rules_channel.messages.fetch();

    if (info.size === 0)
    {
        const embed = new MessageEmbed()
            .setTitle("RULES")
            .setColor("#ffffff")
            // .setURL(embedHighlight.url)
            .setAuthor("BOT")
            // .setAuthor(message.author.tag, message.author.avatarURL(), embedHighlight.url)
            .setDescription("This is RULES")
            // .setThumbnail(message.author.avatarURL())
            .addField("1st rules : ", "1")
            .addField("2nd rules : ", "2")
            .addField("3rd rules : ", "3");
        message = await rules_channel.send( {embeds: [embed]});
    }
    else{
        message = info.first();
    };

    const col = message.createReactionCollector();
    col.on('collect', (reaction, user) => addRole(user));
};

function addRole(user){
    // let role = guild.roles.cache.find(r => r.id === "917473153117204550");
    let member = guild.members.cache.get(user.id);
    member.roles.add(farmer_role);
};

async function add_inf(message) {
	let inf = {
		"filling_out": false,
		"next_post": -1,
		"cur_post": -1,
		"last_posts": []
	}

	message.channel.send("Enter influencer's id");
	const filter = (msg) => {return msg.author.id == message.author.id};
	col = await message.channel.awaitMessages({filter, max: 1, time: 180000, errors: ['time']})
	.catch(collected => {
			console.log("Sorry ! Something wrong happened");
			return;
	});

	if (typeof col == "undefined") {
			message.channel.send("Yout timed out. Please start again");
			return;
	}

	let user_id = col.values().next().value.content;
	let user;
	try {
	  user = await client.users.fetch(user_id);
	} catch (error) {
	  message.channel.send("Sorry ! No such user");
		return;
	}

	if (db.influencers.hasOwnProperty(user.id)) {
		message.channel.send("Sorry ! This user is already an influencer");
		return;
	}

	inf.avatarURL = user.avatarURL();
	inf.tag = user.tag;
	inf.username = user.username;
	db.influencers[user.id] = inf;
	message.channel.send("Congrats ! " + user_id + " is now an influencer");
	return;
}

async function createEmbed(message){

    let embedHighlight = {
        title: "",
        description: "",
        url: "",
				nb_winners: 0,
        thumbnail: "",
        nb_vote: 0,
        list_react_id: [],
        inf_id: ""
    };

	const inf_id = message.author.id;
	const inf = db.influencers[message.author.id];
    // check if he has post in db -> next post
    if (inf.next_post != -1)
    {
        message.channel.send("You already have a post");
        return;
    };

    const filter = (msg) => {return msg.author.id == inf_id};

	embedHighlight.inf_id = inf_id;

    for (const param in embedHighlight)
    {
        message.channel.send(`Pick your ${param} of your videos.`);
        col = await message.channel.awaitMessages({filter, max: 1, time: 180000, errors: ['time']})
        .catch(collected =>{
            console.log("STOP.")
            inf.filling_out = false;
            return;
        });
        if (typeof col == "undefined"){ // 3 min to answer the question
            message.channel.send("You timed out. Please restart");
            inf.filling_out = false;
            return;
        }
        else if (col.values().next().value.content === "exit")
        {
            message.channel.send("You exited.");
            inf.filling_out = false;
            return;
        }
        else {
            embedHighlight[param] = col.values().next().value.content;
            // message.channel.send(`vous venez d'entrez ${embedHighlight[param]}`)
			if (param === "url"){
				let url = embedHighlight.url
				let res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
				if(res == null)
				{
					message.channel.send("You need a valid URL");
					inf.filling_out = false;
					return;
				}
			}
			else if (param === "nb_winners")
			{
				let nb = parseInt(embedHighlight[param]);

				if (Number.isInteger(nb) === true){
					embedHighlight[param] = nb;
				}
				else{
					message.channel.send("You need to put a number.")
					inf.filling_out = false;
					return;
				};
			}
            else if (param === "thumbnail")
            {
                // check if it's img
                let img = col.values().next().value.attachments.values().next().value;
                if (img == undefined) {
                    message.channel.send("You need to send an image file ( no link ).");
                    inf.filling_out = false;
                    return;
                }
                else {
                    embedHighlight[param] = img.url;
                };
                message.channel.send("Is everything correct ?\nType : YES if it's ok or NO if it's not ok");
                //create embed
                let embed = new MessageEmbed()
                    .setTitle(embedHighlight.title)
                    .setColor("#ffffff")
                	// .setURL(embedHighlight.url);
                    // .setAuthor(message.author.username, message.author.avatarURL(), embedHighlight.url)
                    .setAuthor(message.author.username, message.author.avatarURL())
                    .setDescription(embedHighlight.description)
                    .setThumbnail(message.author.avatarURL())
                    .addField("__VIDEO__", `${embedHighlight.url}`)
                    .setImage(embedHighlight.thumbnail)
                    .setFooter(`By @${message.author.tag}`);
                message.channel.send({embeds: [embed]});
                col = await message.channel.awaitMessages({filter, max: 1, time: 180000, errors: ['time']})
                .catch(collected =>{
                    inf.filling_out = false;
                    console.log("STOP.");
                    return;
                });
                if (typeof col == "undefined"){
                    message.channel.send("Le temps est ecoule veuillez refaire tout.");
                    inf.filling_out = false;
                    return;
                }
                if (col.values().next().value.content === "YES" || col.values().next().value.content === "yes")
                {
                    message.channel.send("You are registered for the next week, good luck.");
                    console.log("register on database");
                    db.highlights.push(embedHighlight); // push in DB
                    inf.next_post = db.highlights.length - 1;
                    inf.filling_out = false;
                    return;
                }
                else
                {
                    message.channel.send("You aren't registered for the next week.");
                    inf.filling_out = false;
                    return;
                }
                inf.filling_out = false;
            };
        };
    };
};

function cEmbed(id){
	highlight = db.highlights[id];
	user_id = highlight.inf_id;
	user = db.influencers[user_id];

  const embed = new MessageEmbed()
  .setTitle(highlight.title)
  .setColor("#ffffff")
  // .setURL(embedHighlight.url)
  .setAuthor(user.username, user.avatarURL)
  // .setAuthor(message.author.tag, message.author.avatarURL(), embedHighlight.url)
  .setDescription(highlight.description)
  .setThumbnail(user.avatarURL)
  .addField("__VIDEO__", highlight.url)
	.addField("Vote: ", `${highlight.nb_vote}`)
  .setImage(highlight.thumbnail)
  .setFooter(`By @${user.tag}`);
  return embed;
};

async function open_votes() {

	//clear channel
	msgs = await vote_channel.messages.fetch();
	msgs.forEach(async msg => await msg.delete());
	console.log('yo');

	//get all info from db.influencer.next_post
	for (var influencer_id of Object.keys(db.influencers)) {
		influencer = db.influencers[influencer_id];
		highlight_id = influencer.next_post;
		if (highlight_id !== -1) {
			highlight = db.highlights[highlight_id];
			const embed = cEmbed(highlight_id);
			msg = await vote_channel.send({embeds:[embed]});

			db.msgs[msg.id] = highlight_id;

			//attach react_listener
			const filter = (reac, user) => reac.emoji.name === '🔥';
			const col = msg.createReactionCollector({filter});
			col.on('collect', (r, u) => fire_react_listener(r,u));
		}

		influencer.cur_post =  influencer.next_post;
		influencer.next_post = -1;
	}
};

function fire_react_listener(reaction, user) {
	//check if user has already voted
	if (!db.accounts_day.includes(user.id)) {

		highlight_id = db.msgs[reaction.message.id];
		highlight = db.highlights[highlight_id];

		highlight.list_react_id.push(user.id);

		highlight.nb_vote += 1;

		//user can't vote again for the day
		db.accounts_day.push(user.id);
	}
	else {
		//remove reaction
		reaction.users.remove(user.id);
	}
}

async function new_voting_day() {
	//get all posts in voting channel
	let msgs = await vote_channel.messages.fetch();
	msgs.forEach(msg => {
		msg.reactions.removeAll();
		highlight_id = db.msgs[msg.id];
		const embed = cEmbed(highlight_id);
		msg.edit({embeds:[embed]});
	});
	db.accounts_day = [];
}

async function close_votes() {
	//get ids and empty channel
	highlight_ids = [];
	let channel = client.channels.cache.get(vote_channel_id);
	msgs = await channel.messages.fetch();
	msgs.forEach(msg => {
		highlight_ids.push(db.msgs[msg.id]);
		msg.delete();
	});

	highlights = [];
	highlight_ids.forEach(highlight_id => highlights.push(db.highlights[highlight_id]));
	highlights.sort((a, b) => b.nb_vote - a.nb_vote);
	h_winner = highlights[0];
	h_winner_id = db.highlights.indexOf(h_winner);
	db.winners.push(h_winner_id);

	winners_ids = [];
	for (var i = 0; i < h_winner.nb_winners; i++) {
		do {
			winner_id = h_winner.list_react_id[Math.floor(Math.random() * h_winner.nb_vote)];
		} while (winners_ids.includes(winner_id));
		winners_ids.push(winner_id);
	}
	h_winner['winners_ids'] = winners_ids;

	db.msgs = {};

	for (inf_id of Object.keys(db.influencers)) {
		inf = db.influencers[inf_id];
		inf.last_posts.push(inf.cur_post);
		inf.cur_post = -1;
	}
}

//return string
function generate_highlight_msg(highlight) {
	return highlight.content + '\nVote: ' + highlight.nb_vote + '\nurl: ' + highlight.url;
}

async function generate_leaderboard_embed(highlight_ids) {
    highlights = [];
    highlight_ids.forEach(highlight_id => highlights.push(db.highlights[highlight_id]));
    highlights.sort((a, b) => b.nb_vote - a.nb_vote);
    if (highlights.length === 0){
        return;
    }
    user1_id = highlights[0].inf_id;
    const user1 = await client.users.fetch(user1_id);
    let user2;
    let user3;
    if (highlights.length >= 2){
        user2_id = highlights[1].inf_id;
        user2 = await client.users.fetch(user2_id);
        if (highlights.length >= 3){
            user3_id = highlights[2].inf_id;
            user3 = await client.users.fetch(user3_id);
        }

    };

    const embed = new MessageEmbed()
        .setTitle("LEADERBOARD")
        .setColor("#FFFFFF")
        .setAuthor("LOREM")
        .addField(user1.username, '🥇' + " : " + highlights[0].nb_vote, true);
    if (highlights.length >= 2){
        embed.addField(user2.username, '🥈' + " : " + highlights[1].nb_vote, true);
    }
    if (highlights.length >= 3){
        embed.addField(user3.username, '🥉' + " : " + highlights[2].nb_vote, true);
    }
    let user_id;
    let userr;

    for(let i = 3; highlights.length > i; i++)
    {
         user_id = highlights[i].inf_id;
         userr = await client.users.fetch(user_id);
        embed.addField((i + 1) + "/ " + userr.username + " - vote : " + highlights[i].nb_vote, "\u200B");
    }
    return embed;
}

async function refresh_leaderboard() {
	//TODO
	highlight_ids = [];
	msgs = await vote_channel.messages.fetch();
	msgs.forEach(msg => {
		highlight_ids.push(db.msgs[msg.id]);
	});

	messages = await leaderboard_channel.messages.fetch();

	if (messages.size === 0) {
		const embed = await generate_leaderboard_embed(highlight_ids);
		leaderboard_channel.send({embeds:[embed]});
	}
	else {
		const embed = await generate_leaderboard_embed(highlight_ids);
		messages.first().edit({embeds:[embed]});
	}
}

// setInterval(refresh_leaderboard, 60000);

cron.schedule('5 0 * * 1', function() {
	open_votes();
});

cron.schedule('55 23 * * 1,2,3,4,5,6', function() {
	new_voting_day();
})

cron.schedule('55 23 * * 7', function() {
	close_votes();
})

// TESTER
client.once('ready', async () => {
	console.log('Ready!');
	guild = client.guilds.cache.get(guild_id);

	rules_channel = client.channels.cache.get(rules_channel_id);
	vote_channel = client.channels.cache.get(vote_channel_id);
	leaderboard_channel = client.channels.cache.get(leaderboard_channel_id);

	farmer_role = guild.roles.cache.get(farmer_role_id);
	admin_role = await guild.roles.fetch(admin_role_id);
	await rules();
});


//Gestion des cmds /
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// Set a new item in the Collection
	// With the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

async function get_win(message) {
	let highlight_id = db.winners[db.winners.length -1];
	let highlight = db.highlights[highlight_id];
	highlight.winners_ids.forEach(id => {
		message.channel.send(id);
	});
}

client.on('messageCreate', async message => {

    // const filter = (msg) => {return msg.author.id === message.author.id};
		const is_dm = message.channel.type == 'DM';
		const author = message.author;
		const is_inf = db.influencers.hasOwnProperty(author.id)
		let inf;
		if (is_inf) {
			inf = db.influencers[author.id];
		}
		const is_admin = db.admin.includes(author.id);

		if (is_dm && message.content === "!highlight" && is_inf) {
			if (!inf.filling_out) {
				inf.filling_out = true;
				createEmbed(message);
			}
			return;
		}

    if (is_dm && message.content === "!open_vote" && is_admin) {
      message.channel.send("Opening votes");
			await open_votes();
			return;
    }

		if (is_dm && message.content === "!new_day" && is_admin) {
      message.channel.send("New voting day");
			await new_voting_day();
			return;
    }

		if (is_dm && message.content === "!close_vote" && is_admin) {
      message.channel.send("Closing vote");
			await close_votes();
			return;
    }

		if (is_dm && message.content === "!refresh" && is_admin) {
      message.channel.send("refresh_leaderboard");
			await refresh_leaderboard();
			return;
    }

		if (is_dm && message.content === "!add_inf" && is_admin) {
			await add_inf(message);
			return;
    }

		if (is_dm && message.content === "!get_win" && is_admin) {
			await get_win(message);
			return;
    }
});

// Login to Discord with your client's token
client.login(token);