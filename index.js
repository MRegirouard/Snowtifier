const confReader = require('@eta357/config-reader')
const twitter = require('twitter-api-v2')
const fetch = require('node-fetch')
const sqlite3 = require('sqlite3').verbose()

const configFile = './Options.json'
const configOptions =
{
	'API Key': '',
	'API Key Secret': '',
	'Access Token': '',
	'Access Token Secret': '',
	'Zip Code': '',
	'Snow Day Count':'',
	'School Type':''
}
var config

var tweetInsert

const db = new sqlite3.Database('Tweets.db', (error) =>
{
	if (error)
	{
		console.error('[ FAIL ] Error opening database:', error)
		process.exit(1)
	}


	db.run('CREATE TABLE IF NOT EXISTS tweets (time DATETIME PRIMARY_KEY DEFAULT CURRENT_TIMESTAMP, prediction INTEGER, content TEXT, tweetID TEXT);', (error) =>
	{
		if (error)
		{
			console.error('[ FAIL ] Error creating tweets SQL table:', error)
			process.exit(1)
		}

		tweetInsert = db.prepare('INSERT INTO tweets (prediction, content, tweetID) VALUES (?, ?, ?);', (error) =>
		{
			if (error)
			{
				console.error('[ FAIL ] Error preparing tweets SQL insert:', error)
				process.exit(1)
			}
		})
	})
})

var client

/**
 * Convert a school type string to an "extra val" for the snow day calculator.
 * @param {string} schoolType The school type. Can be 'Public', 'Urban Public',
 * 'Rural Public', 'Private', or 'Boarding'.
 * @returns The "extra val" for snowdaycalculator.com
 */
function getExtraVal(schoolType)
{
	switch (schoolType.toLowerCase())
	{
		case 'urban public':
			return 0.4
		case 'rural public':
		case 'private':
			return -0.4
		case 'boarding':
			return 1
		case 'public':
		default:
			return 0
	}
}

/**
 * Gets the prediction for the desired date from the snow day calculator.
 * @param {Date} date The date to get the prediction for.
 * @param {string} zipCode The zip code to get the prediction for.
 * @param {string} snowDayCount The number of snow days the school has had so far.
 * @param {string} schoolType The school type. Can be 'Public', 'Urban Public',
 * 'Rural Public', 'Private', or 'Boarding'.
 * @returns A promise that resolves to the prediction for the desired date, or
 * rejects with an error or if there is no prediction for the desired date.
 */
function getPrediction(date, zipCode, snowDayCount, schoolType)
{
	return new Promise((resolve, reject) =>
	{
		const extraVal = getExtraVal(schoolType) // The extra val for the school type

		// Query the web page for the prediction
		fetch('https://snowdaycalculator.com/prediction.php?zipcode=' + zipCode + '&snowdays=' + snowDayCount + '&extra=' + extraVal)
			.then((response) => response.text())
			.then((body) =>
			{
				// Find the date code from the given date
				// Format: YYYYMMDD
				const dateCode = date.getFullYear().toString() + ('0' + (date.getMonth() + 1)).slice('-2') + ('0' + date.getDate()).slice('-2')

				for (const line of body.split('\n')) // Loop through the lines
				{
					if (line.startsWith(' theChance[' + dateCode + '] = ')) // Find the desired line
					{
						var prediction = line.split(' ')[3]
						prediction = prediction.slice(0, prediction.length - 1)
						prediction = Math.min(prediction, 99) // Limit the prediction from 0 to 99%
						prediction = Math.max(prediction, 0)
						resolve(prediction) // Resolve the promise with the prediction
						return
					}
				}

				reject('No prediction found') // If we make it here, no prediction was found
				return
			})
			.catch((error) => reject(error))
	})
}

/**
 * Get the week day name from a Date object.
 * @param {Date} date The Date object to get the weekday name from.
 * @returns The name of the week day.
 */
function getWeekday(date)
{
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	return days[date.getDay()]
}

/**
 * Get the month name from a Date object.
 * @param {Date} date The Date object to get the month name from.
 * @returns The name of the month.
 */
function getMonth(date)
{
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
	return months[date.getMonth()]
}

/**
 * Send a tweet with prediction info, and save it in the database.
 * @param {Number} pastPrediction The past prediction for the day. Can be -1 if there is no existing tweeted prediction.
 * @param {Number} currentPrediction The current prediction to tweet about.
 * @param {Date} predictionDate The date of the prediction.
 * @returns A promise that resolves with the content when the tweet is sent and the database is updated, or rejects with an error.
 */
function sendTweet(pastPrediction, currentPrediction, predictionDate)
{
	return new Promise((resolve, reject) =>
	{
		var content

		pastPrediction = Math.round(pastPrediction)
		currentPrediction = Math.round(currentPrediction)
	
		if (pastPrediction == -1 || currentPrediction == pastPrediction) // Prediction hasn't changed, or there was no existing prediction
			content = 'There is a ' + currentPrediction + '% chance of a snow day tomorrow, ' +
				getWeekday(predictionDate) + ', ' + getMonth(predictionDate) + ' ' + predictionDate.getDate() + '.'
		else if (currentPrediction > pastPrediction) // Prediction has increased
			content = 'The chance for a snow day tomorrow has risen from ' + pastPrediction + '% to ' + currentPrediction + '%.'
		else if (currentPrediction < pastPrediction) // Prediction has decreased
			content = 'The chance for a snow day tomorrow has dropped from ' + pastPrediction + '% to ' + currentPrediction + '%.'
	
		const tomorrow = new Date()
		tomorrow.setDate(tomorrow.getDate() + 1)

		if (predictionDate.getFullYear() !== tomorrow.getFullYear() ||
			predictionDate.getMonth() !== tomorrow.getMonth() ||
			predictionDate.getDate() !== tomorrow.getDate()) // If the prediction is not for tomorrow
		{
			content = content.replace('tomorrow,', 'on') // Remove the "tomorrow," from the Tweet
		}

		client.v2.tweet(content).then((data) => // Tweet the prediction
		{	
			tweetInsert.run(currentPrediction, content, data.data.id, (error) => // Update the database
			{
				if (error)
					reject('Error updating Tweet database: ' + error)
				else
					resolve(content)
			})
		})
		.catch((error) =>
		{
			reject('Error sending Tweet: ' + error)
		})
	})
}

confReader.readOptions(configFile, configOptions).then((options) =>
{
	console.info('[  OK  ] Successfully read config information.')
	config = options

	client = new twitter.TwitterApi({
		appKey: config['API Key'],
		appSecret: config['API Key Secret'],
		accessToken: config['Access Token'],
		accessSecret: config['Access Token Secret']
	})

}).catch((error) =>
{
	console.error(error)
	process.exit(1)
})
