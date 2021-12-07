const confReader = require('@eta357/config-reader')
const twitter = require('twitter-api-v2')
const fetch = require('node-fetch')
const sqlite3 = require('sqlite3').verbose()

const configFile = './Options.json'
const configOptions =
{
	'API Key': '',
	'API Key Secret': '',
	'Bearer Token': '',
	'Zip Code': '',
	'Snow Day Count':'',
	'School Type':''
}
var config

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
confReader.readOptions(configFile, configOptions).then((options) =>
{
	console.info('[  OK  ] Successfully read config information.')
	config = options
}).catch((error) =>
{
	console.error(error)
	process.exit(1)
})