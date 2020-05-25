const fs = require('fs')
const { chunkArray } = require('./common/common')
const rimraf = require('rimraf')
const { fork } = require('child_process')
const chalk = require('chalk')
const Gauge = require('gauge')
const tar = require('tar')
const readlineSync = require('readline-sync')

module.exports = class Fetch {
  constructor(registry, targetRegistry) {
    this.registry = registry
    this.targetRegistry = targetRegistry
  }

  parseInstalled() {
    let file = fs.readFileSync('ndc-lock.json')
    let ndcLock
    if (file != null) {
      try {
        ndcLock = JSON.parse(file)
      } catch (e) {
        console.log(chalk.red('ndc-lock.json file is corrupted! run index again.'))
        process.exit(0)
      }
    }
    let toDownload = ndcLock.dependencies
    for (let dep in ndcLock.dependencies) {
      if (ndcLock.dependencies[dep].registries[this.targetRegistry] == null) {
        console.log(chalk.red('There is no setting for ' + this.targetRegistry + ' in ndc-lock! did you compared correctly?'))
        process.exit(0)
      } else {
        if (ndcLock.dependencies[dep].registries[this.targetRegistry].found != false) {
          delete toDownload[dep]
        }
      }
    }

    return toDownload
  }

  process() {

    if (!fs.existsSync('ndc-lock.json')) {
      console.log(chalk.red('there is no ndc-lock.json file! Please run ndc index first!'))
      process.exit(0)
    }
    if (fs.existsSync('ndc-carry.tgz')) {
      let boolYesOrEmpty = readlineSync.keyInYN(chalk.yellow('There already is a ndc-carry.tgz file. would you like to delete and continue?'))
      if (boolYesOrEmpty) {
        if (!readlineSync.keyInYN(chalk.yellow('Are you sure?'))) {
          console.log(chalk.blue('ok,bye!'))
          process.exit(0)
        }
      } else {
        console.log(chalk.blue('ok,bye!'))
        process.exit(0)
      }
    }


    let concurrency = 20

    let toBeDownloaded = Object.entries(this.parseInstalled())

    if (toBeDownloaded.length == 0) {
      console.log(chalk.green('There is no difference found! congrats, you dont have to download and upload anything :)'))
      process.exit(0)
    }

    console.log(chalk.blue('Deleting previously downlaoded packages if exists...'))
    rimraf.sync('./ndc-carry')
    rimraf.sync('./ndc-carry.tgz')
    fs.mkdirSync('./ndc-carry')
    console.log(chalk.blue('Will gather ' + toBeDownloaded.length + ' packages from ' + this.registry + ' that are not in ' + this.targetRegistry))
    let gauge = new Gauge()


    this.extract(toBeDownloaded, concurrency, gauge)

  }

  extract(toBeDownloaded, concurrency, gauge) {
    let timeouted = []
    let chunks = chunkArray(toBeDownloaded, concurrency)
    let endCount = 0
    let packageCount = 0
    for (let i = 0; i < concurrency; i++) {
      let scriptPath = __dirname + '/children/tarGather.js'
      let tarGatherProcess = fork(scriptPath)
      let deps = chunks[i]
      if (deps != null)
        gauge.show('Downloading packages from ' + this.registry + '..…', 0)
      tarGatherProcess.send({ downloadPackages: deps, registry: this.registry })

      tarGatherProcess.on('message', (message) => {
        if (message.event === 'tick') {
          packageCount++
          gauge.pulse()
          gauge.show('fetching ' + packageCount + ' of ' + toBeDownloaded.length, packageCount / toBeDownloaded.length)
        } else if (message.event === 'tick-error') {
          packageCount++
          gauge.pulse()
          gauge.show('fetching ' + packageCount + ' of ' + toBeDownloaded.length, packageCount / toBeDownloaded.length)
          timeouted.push(message.package)
        } else {
          endCount++
          if (endCount === concurrency) {
            gauge.hide()
            if (timeouted.length == 0) {
              fs.copyFileSync('./ndc-lock.json', 'ndc-carry/ndc-lock.json')
              console.log(chalk.blue('Tarring....'))
              tar.c({
                sync: true,
                gzip: true,
                file: 'ndc-carry.tgz'
              }, ['ndc-carry']
              )
              rimraf.sync('ndc-carry')
              console.log(chalk.green('Your ndc-carry.tgz file is ready!'))
            } else {

              console.log(chalk.red('there are ' + timeouted.length + ' timeouts! will download them again.'))
              this.extract(timeouted, concurrency, gauge)

            }
          }
        }

      }
      )

    }
  }
}


