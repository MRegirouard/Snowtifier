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

confReader.readOptions(configFile, configOptions).then((options) =>
{
	console.info('[  OK  ] Successfully read config information.')
	config = options
}).catch((error) =>
{
	console.error(error)
	process.exit(1)
})