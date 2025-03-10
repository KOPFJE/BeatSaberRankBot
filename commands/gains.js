const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const Bottleneck = require(`bottleneck`);

const limiter = new Bottleneck({
    maxConcurrent: 1
});

class Gains extends Command {
    async run(client, message, args) {
        const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
        if (user !== null) {
            const gainedScoresFromUser = await client.db.collection("discordRankBotScores").find({ player: user.scId, gained: true }).count();
            if (gainedScoresFromUser > 0) {
                const botMessage = await message.channel.send("...");
                try {
                    await client.scoresaber.getRecentScores(user.scId);
                }
                catch (err) {
                    botMessage.edit("Failed to get scores. Try again later.");
                    return;
                }


                const newScores = await client.db.collection("discordRankBotScores").find({ player: user.scId, gained: false }).toArray();

                let countOfBeatsavior = 0;
                let erroredMaps = 0;
                let totalLength = 0;
                let totalNotes = 0;
                let totalAcc = 0;
                let totalLeftAcc = 0;
                let totalRightAcc = 0;
                let tdLeft = 0;
                let tdRight = 0;

                for (let i = 0; i < newScores.length; i++) {
                    let map;
                    let mapErrored = false;

                    try { map = await client.beatsaver.findMapByHash(newScores[i].hash); } catch (err) {
                        console.log("Map errored:\n" + err + "Hash: " + newScores[i].hash)
                        mapErrored = true;
                    };

                    if (map === undefined || map === null) {
                        mapErrored = true;
                        erroredMaps++;
                    }

                    if (!mapErrored) {
                        const versionIndex = map.versions.findIndex(versions => versions.hash === newScores[i].hash)
                        if (versionIndex == -1) {
                            console.log(newScores[i].hash)
                            erroredMaps++;
                            continue;
                        }
                        const difficultyData = map.versions[versionIndex].diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(newScores[i].diff) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(newScores[i].diff));

                        if (!difficultyData) {
                            console.log(newScores[i].hash)
                            erroredMaps++;
                            continue;
                        }

                        let mapTotalNotes = difficultyData.notes;

                        totalNotes = totalNotes + +mapTotalNotes;

                        // FIX 
                        // Spaghetti here

                        if (newScores[i].maxscore === 0) {
                            let mapScores = await client.db.collection("beatSaverLocal").find({ leaderboardId: newScores[i].leaderboardId, maxscore: { $gt: 1 } }).toArray();

                            if (mapScores.length === 0) {
                                newScores[i].maxscore = await client.scoresaber.calculateMaxScore(mapTotalNotes);
                                await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: newScores[i].leaderboardId }, { $set: { maxscore: newScores[i].maxscore } });
                            }
                            else if (mapScores[0].maxscore != 0) {
                                newScores[i].maxscore = mapScores[0].maxscore;
                                await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: newScores[i].leaderboardId }, { $set: { maxscore: newScores[i].maxscore } });
                            }
                            else {
                                newScores[i].maxscore = await client.scoresaber.calculateMaxScore(mapTotalNotes);
                                await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: newScores[i].leaderboardId }, { $set: { maxscore: newScores[i].maxscore } });
                            }
                        }

                        if (newScores[i].maxscore < newScores[i].score) {
                            console.log("Warning maxscore smaller than score map: " + newScores[i].leaderboardId)
                        }

                        totalAcc += newScores[i].score / newScores[i].maxscore;
                        if (newScores[i].maxscore === 0) console.log("Warning maxscore 0 | LeaderboardId: " + newScores[i].leaderboardId);
                        totalLength = totalLength + +map.metadata.duration;

                        if (newScores[i].beatsavior) {
                            countOfBeatsavior++;
                            const accTracker = newScores[i].beatsavior.trackers.accuracyTracker
                            isFinite(accTracker.accLeft) ? totalLeftAcc += accTracker.accLeft : totalLeftAcc += 115
                            isFinite(accTracker.accRight) ? totalRightAcc += accTracker.accRight : totalRightAcc += 115

                            isFinite(accTracker.leftTimeDependence) ? tdLeft += accTracker.leftTimeDependence : tdLeft += 0
                            isFinite(accTracker.rightTimeDependence) ? tdRight += accTracker.rightTimeDependence : tdRight += 0
                        }
                    }
                }

                const scProfile = await client.scoresaber.getUser(user.scId);

                await updateUserInfo(scProfile, message, client);

                const ppGained = Math.round((scProfile.pp - user.pp) * 100) / 100;
                const rankChange = user.rank - scProfile.rank;
                const countryRankChange = user.countryRank - scProfile.countryRank;
                const lengthString = new Date(totalLength * 1000).toISOString().substr(11, 8); //Fix?
                const averageNPS = Math.round(totalNotes / totalLength * 100) / 100;
                const averageAccuracyMaps = Math.round(totalAcc / (newScores.length - erroredMaps) * 10000) / 100 + "%";
                const averageAccuracyLeft = Math.round(totalLeftAcc / countOfBeatsavior * 100) / 100;
                const averageAccuracyRight = Math.round(totalRightAcc / countOfBeatsavior * 100) / 100;
                const averageTdLeft = Math.round(tdLeft * 100 / countOfBeatsavior * 100) / 100;
                const averageTdRight = Math.round(tdRight * 100 / countOfBeatsavior * 100) / 100;
                const fcAcc = Math.round(((averageAccuracyLeft + averageAccuracyRight) / 2) / 115 * 10000) / 100;
                const time = calculateTime(user.gainsDate);

                const embed = new Discord.MessageEmbed()
                    .setTitle(`Your gains`)
                    .setURL(`https://scoresaber.com/u/${user.scId}?page=1&sort=recent`)
                    .setThumbnail(`${userAvatar(message.author.avatarURL())}`)
                    .addField(`Rank`, `${rankChange} ${Emote(user.rank, scProfile.rank, message)} ${scProfile.rank}`)
                    .addField(`PP`, `${ppGained} ${Emote(scProfile.pp, user.pp, message)} ${scProfile.pp}`)
                    .addField(`Country :flag_${scProfile.country.toLowerCase()}:`, `${countryRankChange} ${Emote(user.countryRank, scProfile.countryRank, message)} ${scProfile.countryRank}`)
                    .setFooter(`In the last ${time}.`)

                if (newScores.length > 0) {
                    embed.addField(`Playinfo`, `You played ${newScores.length} maps. \nDuration: ${lengthString}.`);
                    embed.addField(`Averages`, `NPS: ${averageNPS} | Acc: ${averageAccuracyMaps}`);
                    if (averageAccuracyLeft > 0) {
                        embed.addField(`Beatsavior (${countOfBeatsavior})`, `TD: ${averageTdLeft} | ${averageTdRight}\nAcc: ${averageAccuracyLeft} | ${averageAccuracyRight}\nFC acc: ${fcAcc}%`)
                    }
                } else {
                    embed.addField(`Playinfo`, `No maps played.`)
                }
                if (erroredMaps > 0) {
                    embed.addField(`Could not find some maps`, `Unable to find ${erroredMaps} maps. Stats not counted.`)
                }
                try {
                    await botMessage.edit("", embed);
                    client.db.collection("discordRankBotScores").updateMany({ player: user.scId, gained: false }, { $set: { gained: true } })

                }
                catch (err) {
                    await message.channel.send("Could not send embed, try again")
                    console.log(err);
                }

            } else {
                let msg = "Setting up your gains for the first time, this will take a while depending on your playcount.\nYou will be pinged once done."
                if (limiter.jobs("EXECUTING").length > 0) msg += " You have been queued."
                message.channel.send(msg);

                limiter.schedule({ id: `Gains ${message.author.username}` }, async () => {

                    const scoresFromUser = await client.db.collection("discordRankBotScores").find({ player: user.scId }).count();

                    if (scoresFromUser > 0) {
                        await client.scoresaber.getRecentScores(user.scId);
                    }
                    else {
                        await client.scoresaber.getAllScores(user.scId);
                    }

                    const scProfile = await client.scoresaber.getUser(user.scId);

                    await updateUserInfo(scProfile, message, client);

                    message.channel.send(`${message.author} you are now setup to use gains command in the future.`);
                    client.db.collection("discordRankBotScores").updateMany({ player: user.scId, gained: false }, { $set: { gained: true } })
                });
            }
        }
        else message.channel.send(`You might not be registered, try doing ${client.config.prefix}addme command first.`);
    }
}
module.exports = Gains;

async function updateUserInfo(scProfile, message, client) {
    await client.db.collection("discordRankBotUsers").updateOne({ discId: message.author.id }, { $set: { discName: message.author.username, pp: scProfile.pp, gainsDate: Date.now(), rank: scProfile.rank, countryRank: scProfile.countryRank } });
}

function Emote(val1, val2, message) {
    if (val1 > val2) return message.guild.emojis.cache.find(emoji => emoji.name === "small_green_triangle_up");
    if (val1 === val2) return ":small_blue_diamond:";
    else return ":small_red_triangle_down:";
}

function userAvatar(avatarURL) {
    if (avatarURL) return avatarURL;
    else {
        const links = [
            "https://cdn.discordapp.com/attachments/840144337231806484/867097443744481280/angryghost.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097448707391528/baseghost.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097452338479134/make.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097456288989235/makeD.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097459925581824/makeEz.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097463433592842/makeHappy.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097467409661992/makeNose.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097471406833694/makeNotAmused.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097475738501147/makeSir.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097478793134100/makeSmallSmile.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097492512309268/makeSnowman.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097498208305182/makeWater.png"
        ]
        let r = Math.floor(Math.random() * links.length);
        return links[r];
    }
}

function calculateTime(ms) {
    let timeArray = [];
    //Milliseconds to seconds
    let delta = Math.abs((Date.now() - ms) / 1000);

    //Whole days
    const days = { amount: Math.floor(delta / 86400), scale: "day" };
    timeArray.push(days);
    delta -= days.amount * 86400;

    //Whole hours
    const hours = { amount: Math.floor(delta / 3600), scale: "hour" };
    timeArray.push(hours);
    delta -= hours.amount * 3600;

    //Whole minutes
    const minutes = { amount: Math.floor(delta / 60), scale: "minute" };
    timeArray.push(minutes);
    delta -= minutes.amount * 60;

    //Seconds
    const seconds = { amount: Math.round(delta), scale: "second" };
    timeArray.push(seconds);

    return twoHighestTimeScales(timeArray);
}

function twoHighestTimeScales(timeArray) {
    let string = "";
    let valuesFound = 0;
    for (let i = 0; i < timeArray.length; i++) {
        if (timeArray[i].amount !== 0) {
            if (valuesFound === 1) string = string + " ";
            if (timeArray[i].amount > 1) timeArray[i].scale = timeArray[i].scale + "s";
            string = string + timeArray[i].amount + " " + timeArray[i].scale;
            valuesFound++;
        }
        if (valuesFound === 2) break;
    }
    return string;
}