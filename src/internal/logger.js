const chalk = require('chalk')
const log = console.log
const raven = require('raven')
const inspect = require('util').inspect
const es = require('elasticsearch')
let ES

if (process.env.ELASTICSEARCH_URI) {
  ES = new es.Client({
    host: process.env.ELASTICSEARCH_URI
  })
}

if (process.env.SENTRY_DSN) {
  raven.config(process.env.SENTRY_DSN, {
    parseUser: false
  }).install()
}

module.exports = {
  debug: (msg, data) => {
    if (process.env.NODE_ENV === 'debug') log(chalk`{bold.green DEBUG}: ${msg}`)
    if (data && ES) sendToES(data)
  },
  log: (msg) => {
    log(chalk`{bold.blue INFO}: ${msg}`) // nothing too interesting going on here
  },
  error: (e, exit = false) => {
    if (!(e instanceof Error)) { // in case strings get logged as errors, for whatever reason
      exit ? log(chalk`{bold.black.bgRed FATAL}: ${e}`) : log(chalk`{bold.red ERROR}: ${e}`)
      if (exit) process.exit(1)
    } else {
      if (raven.installed) raven.captureException(e)
      exit ? log(chalk`{bold.black.bgRed FATAL}: ${e.stack ? e.stack : e.message}`) : log(chalk`{bold.red ERROR}: ${e.stack ? e.stack : e.message}`)
      if (exit) process.exit(1)
    }
  },
  trace: (msg) => {
    if (process.env.NODE_ENV === 'debug') log(chalk`{bold.cyan TRACE}: ${inspect(msg)}`) // trace is the only logging route that inspects automatically
  },
  command: (opts) => { // specifically to log commands being ran
    if (process.env.WILDBEAST_SUPPRESS_COMMANDLOG) return
    log(chalk`{bold.yellow CMD}: ${opts.cmd} by ${opts.m.author.username} in ${opts.m.channel.guild ? opts.m.channel.guild.name : 'DM'}`)
    sendToES({
      cmd: opts.cmd,
      full: opts.cmd + ' ' + opts.opts,
      author: opts.m.author,
      channel: opts.m.channel,
      guild: transform(opts.m.channel.guild)
    })
  }
}

function transform (guild) {
  if (!guild) return
  let proxy = guild
  proxy.joinedAt = new Date(guild.joinedAt).toISOString()
  proxy.createdAt = new Date(guild.createdAt).toISOString()
  // why eris gives numbers instead of dates for this i dont even know
  proxy.emojis = undefined // we really dont care about this
  return proxy
}

function sendToES (opts, type = 'log') {
  if (ES) {
    const moment = require('moment')
    opts['@timestamp'] = new Date().toISOString()
    // TODO: bulk requests to ES
    ES.index({
      index: (process.env.ELASTICSEARCH_INDEX || 'wildbeast') + `-${moment().format('YYYY.MM.DD')}`,
      type: type,
      body: opts
    }).then(global.logger.trace)
  }
}
