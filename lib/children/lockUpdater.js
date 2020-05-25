const Gauge = require('gauge')
const { chunkArray } = require('../common/common')
const { fork } = require('child_process')
const chalk = require('chalk')
const fs = require('fs')
module.exports =
  class PackageLockUpdater {
    constructor (registry) {
      this.registry = registry

      this.process()
    }

    depRewrite (metaMap, packageLock) {

      function changeDeps (branch, location) {
        for (let name in branch) {
          if (branch[name].hasOwnProperty('dependencies')) {
            changeDeps(branch[name].dependencies, location + '.' + name)
          }
          if(metaMap[name + '@' + branch[name].version]!==undefined){
            branch[name].resolved = metaMap[name + '@' + branch[name].version].resolved
            branch[name].integrity = metaMap[name + '@' + branch[name].version].integrity
          }

        }
      }

      changeDeps(packageLock.dependencies, 'dependencies')

      let newPackageLock = packageLock
      fs.copyFileSync('package-lock.json', 'old-package-lock.json')

      fs.writeFileSync('package-lock.json', JSON.stringify(newPackageLock, null, 2))
      console.log(chalk.green('package-lock.json updated! old package-lock.json is saved as "old-package-lock.json'))
    }

    process () {

      if (!fs.existsSync('./package-lock.json')) {
        console.log(chalk.red("cannot update package-lock.json, because it is not here :("))
        return;
      }
      if (!fs.existsSync('./ndc-lock.json')) {
        console.log(chalk.red("cannot update package-lock.json, because it is ndc-lock.json not here :("))
        return;
      }
      let packageLock = JSON.parse(fs.readFileSync('./package-lock.json'))
      let ndcLock = JSON.parse(fs.readFileSync('./ndc-lock.json'));

      let deps = Object.keys(ndcLock.dependencies)
      console.log(chalk.blue('Will update packageLock to be able to be used in ' + this.registry))

      let concurrency = 20
      let gauge = new Gauge()
      let chunks = chunkArray(deps, concurrency)
      let toBeFetched = deps.length
      let endCount = 0
      let packageCount = 0
      let updatedMetaMap = {}
      for (let i = 0; i < concurrency; i++) {
        try {
          let scriptPath = __dirname + '/pacoteDetailsGatherer.js'
          let integrityGathererProcess = fork(scriptPath);
          let packages = chunks[i]
          if (packages != null) {
            gauge.show('Gathering information of packages from ' + this.registry + '..…', 0)
          }
          integrityGathererProcess.send({ packages, registry: this.registry })
          integrityGathererProcess.on('message', (message) => {
            if (message.event === 'tick') {
              packageCount++
              gauge.pulse()
              gauge.show('gathering...', packageCount / toBeFetched)

            } else if (message.event === 'finish') {
              endCount++
              updatedMetaMap = { ...updatedMetaMap, ...message.metas }
              if (endCount === concurrency) {
                this.depRewrite(updatedMetaMap, packageLock)
              }
            } 
          })
        } catch (e) {
          console.log(chalk.red('error occured while processing!'))
        }
      }

    }
  }
