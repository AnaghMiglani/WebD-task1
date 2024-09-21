const express = require('express');
const axios = require('axios');
const qs = require('querystring');
require('dotenv').config();

const app = express();
const PORT = 5500; // google cloud console will only work with localhost:5500

app.use(express.static('public'));

// To fix "CANNOT GET / error"
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Welcome to the Protected Page</h1>
      <br>
      <h2>To access this page, you need to log in via YouTube.</h2>
      <br>
      <h3><a href="/login">Click here to log in with YouTube</a></h2>
      <br>
    </body>
    </html>
  `);
});

// google login
app.get('/login', (req, res) => 
  {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
  })}`;
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => 
  {
  const { code } = req.query;

  if (!code) 
  {
    return res.status(400).send('Missing authorization code');
  }

  try 
  {
    const response = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
      code,
      //take from env file
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = response.data;
    
    res.redirect(`/check-subscription?token=${access_token}`);
  } catch (error) {
    console.error('Error exchanging code for token:', error.response ? error.response.data : error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/check-subscription', async (req, res) => {
  const { token } = req.query;
  const targetChannelId = "UCgIzTPYitha6idOdrr7M8sQ";  // channel id for byte yt account

  if (!token) {
    return res.redirect('/login'); // if no token, force the user to login
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
      headers: { Authorization: `Bearer ${token}`,'Cache-Control':'no-cache' },
      params: {
        part: 'snippet',
        mine: true,
      },
    });

    const subscriptions = response.data.items;
    const isSubscribed = subscriptions.some(subscription => 
      subscription.snippet.resourceId.channelId === targetChannelId
    );

    if (isSubscribed) {
      res.send(`
        <html>
        <body>
          <link rel="stylesheet" href="/styles.css">
          <h1>You are subscribed! Access granted.</h1>
          <br>
          <h3>Please Click this <a href="https://byte-site.vercel.app/">link</a> to access b.y.t.e. website</h3>
          <br>
        </body>
        </html>
      `);
    } 
    else {
      res.send(`
        <html>
        <body>
          <link rel="stylesheet" href="/styles.css">
          <h1>Access denied.</h1> 
          <br>
          <h3>You are not subscribed to the required YouTube channel.</h3>
          <br>
          <h3>Pls <a href="https://www.youtube.com/@BYTE-mait">subscribe</a> and click <a href="/login">here</a> to relogin</h3>
          <br>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error fetching subscriptions:', error.response ? error.response.data : error);
    res.status(500).send('Failed to check subscription');
  }
});

// display server start
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
