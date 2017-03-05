'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const moment = require('moment')

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = "ONVNU5ZM5S2Z7RQGAEMVG4HU6XM5F3UR"

// Messenger API parameters -- Update these to server-side when pushing to Heroku
const FB_PAGE_TOKEN = "EAAD29eyVGaoBAJWcptubhZA0BkIarbB8ZBZBCB9j7A38CtoXw2z8ZCaoxaeFk0jsM16ZAkrDeuycgLtHVCfhMWnXPC8T8t93ZBZAHq7oeFZB9cOowuJt6WrnpUV5qtcjZC8o8FfFupZASNwZA4lTP1Vo9tuQ8ACli8K2EA2ZCdYAPMLJ7gZDZD"
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = "9b427152405a9db5d1a1c664538d3c20"
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

let FB_VERIFY_TOKEN = "hello_nasty";
console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);


// Initialise moment for english date formats
moment.locale('en')

// Declare variables for JSON reading
var fs = require('fs')

// Read the data file and output to console
var contents = JSON.parse(fs.readFileSync('./cineplex-all.json', 'utf8'))
contents = contents.cinema

//Print movie count from JSON file test
console.log("Count of movies: " + contents[0].movie.length)

//Print name from JSON file test
console.log (contents[0].movie[0].name)


// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, data) => {
  const body = JSON.stringify({
    recipient: { id },
    message:  data,
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

//Helpers

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};


// Our bot actions
const actions = {
  send({sessionId}, response) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!

       if (response.quickreplies) { // Wit.ai wants us to include quickreplies, alright!
				response.quick_replies = []; // The quick reply object from Wit.ai needs to be renamed.
				for (var i = 0, len = response.quickreplies.length; i < len; i++) { // Loop through quickreplies
					response.quick_replies.push({ title: response.quickreplies[i], content_type: 'text', payload: 'CUSTOM_WIT_AI_QUICKREPLY_ID' + i });
				}
				delete response.quickreplies;
			}

      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, response)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart

  getForecast({context, entities}) {
    return new Promise(function(resolve, reject) {
      // Here should go the api call, e.g.:
      // context.forecast = apiCall(context.loc)
      context.forecast = 'rainy';
      return resolve(context);
    });
  },

  // Gather all the initial information

  merge({context, entities}) {
    return new Promise(function(resolve, reject) {
      // Retrive the location entity and store it in the context field
      var location = firstEntityValue(entities, 'location')
      if (location) {
        context.location = location
      }
      console.log("The current location is: " + location)


      // Retrieve the movie
      var movie = firstEntityValue(entities, 'movie')
      if (movie) {
        context.movie = movie
      }
      console.log("The current movie is: " + movie)

      // Retrieve the datetime
      var datetime = firstEntityValue(entities, 'datetime')
      if (datetime) {
        console.log("datetime coming from the bot is: " + datetime)
        // Set current date and time
        datetime = moment().add(10, 'hours')
        context.datetime = moment(datetime).format("dddd, MMMM Do YYYY, h:mm:ss a")
        console.log("current datetime in context.datetime is: " + context.datetime)
      }
      return resolve(context);
    });
	},


	fetchMovie({context, entities}) {
    return new Promise(function(resolve, reject) {
      //Set current date and time, offset by 10 hours for AEST
      //var currentDateTime = moment().add(10, 'hours')
      var currentDateTime = moment();
      

      //Loop through cinema locations
      findLocation(0)
      function findLocation(i){
        for (var i = 0; i < contents.length; i++) {
          console.log("context.location =" + context.location.toLowerCase())
          console.log("contents of array: " + contents[i].location.toLowerCase())
          if (context.location.toLowerCase() == contents[i].location.toLowerCase()) {
            console.log("Location match found!")
            context.locationCount = i
            console.log("context.locationCount: " + context.locationCount)
            contents = contents[i]
            return //Break out of for loop when location is found
            
          }
        }
      }

      findSession(0)
      //Loop through movies
      function findSession(i) {
        for (var i; i < contents.movie.length; i++) {
          //Loop through movie dates, match to today
          for (var j = 0; j < contents.movie[i].day.length; j++) {

            var movieStartDate = contents.movie[i].day[j].date
            //Ingest dates from JSON file according to the format on the site
            movieStartDate = moment(movieStartDate, "dddd Do MMMM YYYY")

              if (moment(movieStartDate).isSame(currentDateTime, 'day')) {

                //Set a preliminary matched date
                var movieStartDate = contents.movie[i].day[j].date

                //Examine session times within this date
                for (var k = 0; k < contents.movie[i].day[j].session.length; k++) {
                  var movieStartTime = movieStartDate + " " + contents.movie[i].day[j].session[k].sessionTime

                  //Ingest dates from JSON file according to the format on the site
                  movieStartTime = moment(movieStartTime, "dddd Do MMMM YYYY h:mm A")
                    if (moment(movieStartTime).isAfter(currentDateTime)) {
                      //Set a matched session
                      var movieStartTime = contents.movie[i].day[j].session[k].sessionTime
                      context.movieStartTime = movieStartTime
                      var currentDateTimeLog = moment(currentDateTime).format("h:mm a")
                      console.log("Match found! Session time of " + movieStartTime + " is later than current time of " + currentDateTimeLog + ".")

                      //Set all matched elements
                      var movieName = contents.movie[i].name
                      context.movieName = movieName
                      var movieStartDate = contents.movie[i].day[j].date
                      context.movieStartDate = movieStartDate
                      var movieStartTime = contents.movie[i].day[j].session[k].sessionTime
                      context.movieStartTime = movieStartTime
                      var movieBookingURL = contents.movie[i].day[j].session[k].bookingURL
                      context.movieBookingURL = movieBookingURL
                      context.movieCount = i
                      return // Break out of for loop
                    }
                }
              }
            }
          }

        //No movies found! The last session has probably ended for the day.
        if (typeof context.movieCount == "undefined") {
          context.noMoviesFound = "That's all folks!"
          context.noMoviesFoundGIF = "http://i.imgur.com/fcTpTHZ.gif"
        }

      } //End function

    return resolve(context);
    }); // End promise

  }, //End fetchMovie

  nextMovie({context, entities}) {
    return new Promise(function(resolve, reject) {
      
    // move on to next movie

		//Set current date and time, offset by 10 hours for AEST
		var currentDateTime = moment();
    console.log(contents)

		//Loop through movies
		function findSession(i) {
		for (var i; i < contents.movie.length; i++) {
			//Loop through movie dates, match to today
			for (var j = 0; j < contents.movie[i].day.length; j++) {

				var movieStartDate = contents.movie[i].day[j].date
				//Ingest dates from JSON file according to the format on the site
				movieStartDate = moment(movieStartDate, "dddd Do MMMM YYYY")

					if (moment(movieStartDate).isSame(currentDateTime, 'day')) {

						//Set a preliminary matched date
						var movieStartDate = contents.movie[i].day[j].date

						//Examine session times within this date
						for (var k = 0; k < contents.movie[i].day[j].session.length; k++) {
							var movieStartTime = movieStartDate + " " + contents.movie[i].day[j].session[k].sessionTime
							console.log("movieStartTime: " + movieStartTime)

							//Ingest dates from JSON file according to the format on the site
							movieStartTime = moment(movieStartTime, "dddd Do MMMM YYYY h:mm A")
							console.log("movieStartTime: " + movieStartTime + ", current Datetime: " + currentDateTime)

								if (moment(movieStartTime).isAfter(currentDateTime)) {

									//Set a matched session
									var movieStartTime = contents.movie[i].day[j].session[k].sessionTime
									context.movieStartTime = movieStartTime
									var currentDateTimeLog = moment(currentDateTime).format("h:mm a")
									console.log("Match found! Session time of " + movieStartTime + " is later than current time of " + currentDateTimeLog + ".")

									//Set all matched elements
									var movieName = contents.movie[i].name
									context.movieName = movieName
									var movieStartDate = contents.movie[i].day[j].date
									context.movieStartDate = movieStartDate
									var movieStartTime = contents.movie[i].day[j].session[k].sessionTime
									context.movieStartTime = movieStartTime
                  var movieBookingURL = contents.movie[i].day[j].session[k].bookingURL
                  context.movieBookingURL = movieBookingURL

									context.movieCount = i
									return // Break out of for loop
								}
						}
					}
				}
			}
    }


		var movieCount = context.movieCount
		movieCount = movieCount + 1
		findSession(movieCount)



    return resolve(context);
    }); // End promise

    }, //End nextMovie


};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, { text: 'Sorry I can only process text messages for now.'})
            .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');
