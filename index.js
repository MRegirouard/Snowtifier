const confReader = require('@eta357/config-reader')
const twitter = require('twitter')
const fetch = require('node-fetch')

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
confReader.readOptions(configFile, configOptions).then((options) =>
{
	console.info('[  OK  ] Successfully read config information.')
	config = options
}).catch((error) =>
{
	console.error(error)
	process.exit(1)
})