const Gauge = require('gauge')
const fs = require('fs')
const chalk = require('chalk')
const tar = require('tar')
const rimraf = require('rimraf')
const { chunkArray } = require('./common/common')
const { fork } = require('child_process')
const shell = require('shelljs')


module.exports = class Compare {
  constructor (registry) {
    this.registry = registry
  }

  process () {
    if (!fs.existsSync('ndc-carry.tgz')) {
      console.log(chalk.red('there is no ndc-carry.tgz file! Please run ndc index, compare and fetch first!'))
      process.exit(0)
    }
    if (fs.existsSync('ndc-carry')) {
      rimraf.sync('ndc-carry')
    }
    console.log(chalk.blue('extracting files...'))
    tar.x(
      {
        file: 'ndc-carry.tgz',
        sync: true
      }
    )
    let listOfTars = fs.readdirSync('./ndc-carry')
    listOfTars = listOfTars.filter(element => {
      return element !== 'ndc-lock.json'
    })
    console.log(chalk.blue('Will publish ' + listOfTars.length + ' packages to ' + this.registry))

    let concurrency = 10
    let gauge = new Gauge()
    let chunks = chunkArray(listOfTars, concurrency)
    let endCount = 0
    let packageCount = 0
    let toBePublished = listOfTars.length
    let alreadyHave = []
    let nativeSend = []
    let published = 0
    if (fs.existsSync('ndc-temp')) {
      rimraf.sync('ndc-temp')
    }

    fs.mkdirSync('ndc-temp')
    for (let i = 0; i < concurrency; i++) {
      try {
        let scriptPath = __dirname + '/children/tarPublish.js'
        let tarPublishProcess = fork(scriptPath);
        let packages = chunks[i]
        if (packages != null) {
          gauge.show('Publishing packages to ' + this.registry + '..…', 0)
        }

        tarPublishProcess.send({ packages, registry: this.registry })
        tarPublishProcess.on('message', (message) => {
          if (message.event === 'tick') {
            published++
            packageCount = this.updateGauge(packageCount, gauge, toBePublished)
          } else if (message.event === 'tick-have') {
            packageCount = this.updateGauge(packageCount, gauge, toBePublished)
            alreadyHave.push(message.package)
          } else if (message.event === 'tick-error') {
            packageCount = this.updateGauge(packageCount, gauge, toBePublished)
            nativeSend.push(message.package)

          } else if (message.event === 'kill-all') {
            gauge.hide()
            rimraf.sync('ndc-temp')
            rimraf.sync('ndc-carry')
            process.exit(1)
          } else {
            endCount++
            if (endCount === concurrency) {
              let nativePublished = []
              if (nativeSend.length > 0) {
                nativePublished = this.nativePublish(nativeSend)
              }
              this.finalize(gauge, alreadyHave, published, nativePublished, nativeSend)
            }
          }
        })
      } catch (e) {
        console.log(chalk.red('error occured while processing!'))
      }
    }
  }

  updateGauge (packageCount, gauge, toBePublished) {
    packageCount++
    gauge.pulse()
    gauge.show('publishing...', packageCount / toBePublished)
    return packageCount
  }

  nativePublish (nativeSend) {
    let nativePublished = []
    console.log(chalk.blue('trying to send failed packages again natively. There are ' + nativeSend.length + ' of them....'))
    process.chdir('ndc-carry')
    nativeSend.forEach(element => {
      let shellData = shell.exec('npm publish ' + element + ' --registry=' + this.registry, { silent: true })
      if (shellData.stderr) {
        if ((shellData.stderr.indexOf('ERR!') >= 0)) {
          if (shellData.stderr.indexOf('E400') < 0) {
            console.log(chalk.red(shellData.stderr))
            return
          } else {
            console.log(chalk.green('Seems like you already have: ' + element))
          }
        }
      }
      nativePublished.push(element)
    })
    return nativePublished
  }

  finalize (gauge, alreadyHave, published, nativePublished, nativeSend) {
    gauge.hide()
    rimraf.sync('ndc-temp')
    rimraf.sync('ndc-carry')
    nativePublished = nativePublished.filter(function (el) {
      return nativeSend.indexOf(el) < 0
    })
    if (alreadyHave.length > 0) {
      console.log(chalk.green('You already have ' + alreadyHave.length + ' packages.'))
    }
    if (nativeSend.length > 0) {
      console.log(chalk.green(nativeSend.length + ' elements are natively published.'))
    }
    if (nativePublished.length > 0) {
      console.log(chalk.red(nativePublished.length + ' elements couldn\'t published. These are:'))
      nativePublished.forEach(el => {
        console.log(chalk.red('   ' + el))
      })
    }

    console.log(chalk.green((published + nativeSend.length) + ' packages published to ' + this.registry + '!'))
    process.chdir('../')
    console.log(chalk.blue('Cleanup will be perfomed'));
    rimraf.sync('ndc-carry')
    rimraf.sync('ndc-temp')
    rimraf.sync('ndc-carry.tgz')
    console.log(chalk.green('All clear! happy coding!'));
  }


}
