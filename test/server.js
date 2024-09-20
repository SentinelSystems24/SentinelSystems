const express = require('express');
const session = require('express-session');
const passport = require('passport');
const Strategy = require('passport-discord').Strategy;
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(express.static('public')); // Serve static files from the public folder

// Session setup
app.use(session({
    secret: '3k7yCQkm2SNXfXh7vVFLWS6UOuSiuvq-',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport strategy setup
passport.use(new Strategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Routes
const axios = require('axios');

app.get('/guilds', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const userGuilds = req.user.guilds;

    try {
        // Fetch the bot's guilds using your bot's token
        const botGuilds = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                Authorization: `Bot ${process.env.BOT_TOKEN}`
            }
        });

        const botGuildsIds = botGuilds.data.map(guild => guild.id);

        // Mark user-owned guilds and add a "botInGuild" flag
        let guilds = userGuilds
            .filter(guild => guild.owner) // Only show owned guilds
            .map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`,
                botInGuild: botGuildsIds.includes(guild.id)
            }));

        // Sort guilds so those where the bot is a member are at the top
        guilds = guilds.sort((a, b) => (b.botInGuild - a.botInGuild));

        res.json(guilds);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch guilds' });
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET || '3k7yCQkm2SNXfXh7vVFLWS6UOuSiuvq-',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});

app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    res.sendFile(__dirname + '/public/profile.html'); // Serve the profile page
});

app.get('/user-data', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const user = req.user;

    // Format UNIX timestamp for createdAt date
    const createdAt = new Date(user.id / 4194304 + 1420070400000); // Discord Snowflake conversion
    const userData = {
        username: `${user.username}`,
        avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        createdAt: createdAt,
        rank: 'Sentinel CEO'
    };

    res.json(userData);
});

app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    res.sendFile(__dirname + '/public/dashboard.html'); // Serve a dashboard page
});


app.get('/team', (req, res) => {
    res.sendFile(__dirname + '/public/team.html');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
