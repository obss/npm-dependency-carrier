const fs = require('fs')
const chalk = require('chalk')
const { fork } = require('child_process')
const Gauge = require('gauge')
const shell = require('shelljs')
const rimraf = require('rimraf')
const readlineSync = require('readline-sync')
const { chunkArray } = require('./common/common')

module.exports = class Indexer {
  constructor (registry, targetRegistry) {
    this.registry = registry
    this.targetRegistry = targetRegistry

  }

  parseInstalled (lsOutput) {
    console.log(chalk.blue('parsing installed packages..'))
    let data = lsOutput.split('\n')
    data.splice(0, 1)
    if (data[0].indexOf('UNMET DEPENDENCY') > -1) {
      console.error(chalk.black.bgRed.bold('LOOKS LIKE npm install FAILED!'))
      console.error(chalk.blue('Please install the project on en env that has internet'))
      console.error(chalk.blue('Dont forget to remove internal lib dependencies from package.json!'))
      console.error(chalk.blue('Also, you can only carry package.json, package-lock.json and ndc-lock.json to internet 😊'))
      process.exit(1)
    }

    let nondeduped = data.filter(entry => entry.lastIndexOf('deduped') === -1)
    let deduped = data.filter(entry => entry.lastIndexOf('deduped') !== -1)

    let filtered = nondeduped.map(entry => entry.substr(entry.lastIndexOf('-- ') + 3, entry.length)).filter(entry => entry.length > 0)
    filtered = [...new Set(filtered)]
    let filteredDeduped = deduped.filter(entry => entry.length > 0).map(entry => entry.substr(entry.lastIndexOf('-- ') + 3, entry.length))
      .map(entry => entry.substr(0, entry.indexOf(' '))).filter(entry => filtered.indexOf(entry) < 1)
    filteredDeduped = [...new Set(filteredDeduped)]

    let allDeps = filtered.concat(filteredDeduped)
    let unmets=allDeps.filter(entry=>entry.lastIndexOf("UNMET")>-1).map(entry => entry.substring(entry.indexOf("DEPENDENCY")+11)).filter(entry => entry.length>1);
    allDeps = allDeps.filter(entry=>entry.lastIndexOf("UNMET")===-1)
    allDeps =allDeps.concat(unmets)
    return allDeps

  }

  updateLockFile (gatheredInformation) {
    let ndcLock = {}
    if (fs.existsSync('ndc-lock.json')) {
      let ndcLockFile = fs.readFileSync('ndc-lock.json')

      try {
        ndcLock = JSON.parse(ndcLockFile)
      } catch (e) {
        console.log(chalk.red('ndc-lock file is corrupted!'))
        process.exit(0)
      }

    }

    if (ndcLock.dependencies == null) {
      ndcLock.dependencies = {}
    }
    let preSaveNdcLock = JSON.parse(JSON.stringify(ndcLock))
    for (let dep in gatheredInformation) {
      if(dep.indexOf("||")>-1){
        process.exit(0)
      }
      if (ndcLock.dependencies[dep] == null) {
        ndcLock.dependencies[dep] = gatheredInformation[dep]
      } else {
        ndcLock.dependencies[dep].registries[this.registry] = gatheredInformation[dep].registries[this.registry]
      }
      if (this.targetRegistry) {
        if (ndcLock.dependencies[dep].registries[this.targetRegistry] == null) {
          ndcLock.dependencies[dep].registries[this.targetRegistry] = { found: false }
        }
      }
      delete preSaveNdcLock.dependencies[dep]
    }
    for (let dep in preSaveNdcLock.dependencies) {
      ndcLock.dependencies[dep].registries[this.registry] = { found: false }
      if (this.targetRegistry) {
        if (ndcLock.dependencies[dep].registries[this.targetRegistry] == null) {
          ndcLock.dependencies[dep].registries[this.targetRegistry] = { found: false }
        }
      }
    }
    let strignified = JSON.stringify(ndcLock, null, 2)
    fs.writeFileSync('ndc-lock.json', strignified)
    console.log(chalk.green('ndc-lock.json is created!'))
  }

  process () {
    if (this.targetRegistry == null) {
      if (fs.existsSync('ndc-lock.json')) {
        let boolYesOrEmpty = readlineSync.keyInYN(chalk.yellow('There already is a ndc-lock.json file. would you like to delete and continue?'))
        if (boolYesOrEmpty) {
          if (readlineSync.keyInYN(chalk.yellow('Are you sure?'))) {
            rimraf.sync('ndc-lock.json')
            this.process()
          } else {
            console.log(chalk.blue('ok,bye!'))
            process.exit(0)
          }
        } else {
          console.log(chalk.blue('ok,bye!'))
          process.exit(0)
        }

      }
    }
    let individualDependencies = this.parseInstalled(shell.exec('npm ls', { silent: true }).stdout)
    console.log(chalk.blue('Will gather information about ' + individualDependencies.length + ' dependencies present on ' + this.registry))

    let concurrency = 20

    let metas = {}
    let endCount = 0
    let packageCount = 0
    let chunks = chunkArray(individualDependencies, concurrency)
    let gauge = new Gauge()
    for (let i = 0; i < concurrency; i++) {
      let scriptPath = __dirname + '/children/pacoteGather.js'
      let pacoteProcess = fork(scriptPath)
      let deps = chunks[i]
      if (deps != null)
        gauge.show('Checking ' + this.registry + ' for packages..…', 0)
      pacoteProcess.send({ individualDependencies: deps, registry: this.registry })
      pacoteProcess.on('message', (message) => {
        if (message.event === 'tick') {
          packageCount++
          gauge.pulse()
          gauge.show('gathering...', packageCount / individualDependencies.length)
        } else {
          metas = Object.assign({}, metas, message.metas)
        }

      })
      pacoteProcess.on('exit', () => {
        endCount++
        if (endCount === concurrency) {
          gauge.hide()
          this.updateLockFile(metas)
        }
      })
    }
  }

}
