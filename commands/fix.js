const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const hashSearchLimiter = new Bottleneck({
    reservoir: 200,
    reservoirRefreshAmount: 200,
    //Millisecond - Second - Minutes
    reservoirRefreshInterval: 1000,

    minTime: 5
})

class Fix extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            if (args[0] === "removedupe") {
                let removedScores = 0;
                let result = await client.db.collection("discordRankBotScores").aggregate(
                    {
                        $group: {
                            _id: { player: "$player", leaderboardId: "$leaderboardId" },
                            count: { $sum: 1 },
                            docs: { $push: "$score" }
                        }
                    },
                    {
                        $match: {
                            count: { $gt: 1 }
                        }
                    }
                ).toArray();
                for (let i = 0; i < result.length; i++) {
                    if (result[i].count >= 2) {
                        result[i].docs.sort((a, b) => b - a);
                        await client.db.collection("discordRankBotScores").deleteMany({ player: result[i]._id.player, leaderboardId: result[i]._id.leaderboardId, score: { $lt: result[i].docs[0] } });
                        removedScores++
                    }
                }
                await message.channel.send(`Removed ${removedScores} old scores.`);
                return;
            }
            if (args[0] === "addcountrytoscores") {
                const botMessage = await message.channel.send("...")
                const users = await client.db.collection("discordRankBotScores").distinct("player");
                let scoresUpdated = 0;
                for (let i = 0; i < users.length; i++) {
                    const user = await client.scoresaber.getUser(users[i]);
                    const response = await client.db.collection("discordRankBotScores").updateMany({ player: users[i] }, { $set: { country: user.country } });
                    scoresUpdated += response.modifiedCount;
                }
                await botMessage.edit(`Updated ${scoresUpdated} to include country tag.`);
            }
            if (args[0] === "unrank/rank") {
                const response = await client.db.collection("discordRankBotScores").updateMany({ pp: { $gt: 0 }, ranked: false }, { $set: { ranked: true } });
                const response2 = await client.db.collection("discordRankBotScores").updateMany({ pp: 0 }, { $set: { ranked: false } });
                await message.channel.send(`Updated ${response.modifiedCount} maps to include ranked true`);
                await message.channel.send(`Removed ranked status from ${response2.modifiedCount}.`)
            }
            if (args[0] === "ppcheck") {
                console.time("ppcheck")
                let scoresToRecheck = [];
                let userIdName = [];
                const rankedMaps = await client.db.collection("scoresaberRankedMaps").find().toArray();
                for (let i = 0; i < rankedMaps.length; i++) {
                    const scoresWithoutPp = await client.db.collection("discordRankBotScores").find({ pp: 0, leaderboardId: rankedMaps[i].id }).toArray();
                    for (let j = 0; j < scoresWithoutPp.length; j++) {
                        const user = userIdName.find(player => player.id === scoresWithoutPp[j].player);
                        let userName;
                        if (!user) {
                            console.log("new user");
                            const scUser = await client.scoresaber.getUser(scoresWithoutPp[j].player);
                            userIdName.push({ id: scoresWithoutPp[j].player, name: scUser.name });
                            userName = scUser.name;
                        }
                        else {
                            userName = user.name
                        }
                        scoresToRecheck.push({ playerId: scoresWithoutPp[j].player, leaderboardId: scoresWithoutPp[j].leaderboardId, name: userName })
                    }
                }
                for (let i = 0; i < scoresToRecheck.length; i++) {
                    await client.scoresaber.getUserScoreOnLeaderboard(scoresToRecheck[i].playerId, scoresToRecheck[i].name, scoresToRecheck[i].leaderboardId)
                }
                console.timeEnd("ppcheck")
                await message.channel.send(`Recheck ${scoresToRecheck.length} scores for a pp value`);
            }
            if (args[0] === "jsondump") {
                const scores = await client.db.collection("discordRankBotScores").find({ leaderboardId: parseInt(args[1]) }).toArray();

                console.log(scores);

                const jsonScores = JSON.stringify(scores, null, 2);
                const jsonBuffer = Buffer.from(jsonScores, "utf-8");
                const attachment = new Discord.MessageAttachment(jsonBuffer, `jsonDump-${args[1]}.json`);
                await message.channel.send("Here you go", attachment);
            }
            if (args[0] === "mapdate") {
                const maps = await client.db.collection("beatSaverLocal").find({ "versions.createdAt": { $type: "string" } }).toArray();
                let changedMapCount = 0;
                for (let i = 0; i < maps.length; i++) {
                    let map = maps[i];
                    for (let j = 0; j < map.versions.length; j++) {
                        const date = new Date(map.versions[j].createdAt).getTime();
                        if (date > 1000000000) {
                            map.versions[j].createdAt = date;
                            changedMapCount++
                        }
                    }
                    await client.db.collection("beatSaverLocal").updateOne({key: map.key}, {$set: map});
                }
                console.log(maps.length);
                await message.channel.send(`Changed ${changedMapCount} date formats.`)
            }
            else {
                return;
                const maps = await client.db.collection("beatSaverLocal").find({ "versions.diffs.me": { $exists: false } }).toArray();
                console.time()
                const promises = [];
                for (let i = 0; i < maps.length; i++) {
                    promises.push(
                        hashSearchLimiter.schedule(async () => fetch(`https://beatsaber.tskoll.com/api/v1/hash/${maps[i].versions[0].hash}`)
                            .then(res => res.json()))
                            .then(res => {

                                //client.db.collection("beatSaverLocal").updateOne({ "versions.hash": res.hash }, { $set: { me: 1, ne: 2, cinema: 3 } })
                            })
                            .catch(err => console.log(maps[i].versions[0].hash)))

                }
                await Promise.all(promises);
                console.log(promises);
                console.timeEnd()

                //1 = ne
                //2 = me
                //4 = chroma
                //8 = cinema

                //  look for maps with this.
                // hit the maps through https://beatsaber.tskoll.com/api/v1/hash/${hash}
                // Update me/ne/chroma etc. fields.
            }
        }
    }
}
module.exports = Fix;