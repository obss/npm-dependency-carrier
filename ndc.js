#!/usr/bin/env node
const indexer = require('./lib/indexDeps')
const comparator = require('./lib/compareDeps')
const fetcher = require('./lib/fetchDeps')
const publisher = require('./lib/publishDeps')
const relocker = require('./lib/updatePackageLock')
const { Command } = require('commander')
const chalk = require('chalk')
const program = new Command()
const ping = require('ping')
let pingCfg = {
  timeout: 2
}
const npmRegistery = 'https://registry.npmjs.org'

let index = new Command('index')
index.description(chalk.blue('Creates new ndc.lock file for fresh for fresh installation. ') + chalk.red('REQUIRES SUCCESSFUL \'npm install\', and requires real package.json, package-lock.json and node_modules'))
index.option('-r, --registry [registry]', chalk.blue('[OPTIONAL] Registry to be used to create ndc.lock file. Default value is "https://registry.npmjs.org"'))
index.option('-tr, --targetRegistry [targetRegistry]', chalk.blue('[OPTIONAL] Target repository to for carrying data. If filled, ndc-lock will not be deleted, and all new entries will be marked as not found in targetRepo. This will allow you to ignore compare step.\nIf you are using a group npm registry, make this your group registry so difference may be minimal.'))
index.action((command) => {
  let registry = command.registry
  if (registry === undefined) {
    registry = npmRegistery
  }
  let targetRegistry = command.targetRegistry;
  let count = 0
  let tempReg = registry.replace(/(^\w+:|^)\/\//, '')
  tempReg = tempReg.split(':')[0]
  let hosts = [tempReg]
  hosts.forEach(function (host) {
    ping.sys.probe(host, function (isAlive) {
      count++
      if (isAlive == false) {
        console.log(chalk.red('cannot connect to: ' + host + '! exiting...'))
        process.exit(0)
      }
      if (count == hosts.length) {
        let indexExecutor = new indexer(registry,targetRegistry)
        indexExecutor.process()
      }

    }, pingCfg)
  })

})

let compare = new Command('compare')
compare.description(chalk.blue('Updates ndc.lock to compare given registry with locked one.') + chalk.red('REQUIRES SUCCESSFUL \'ndc index\', and requires a ndc-lock.json file'))
compare.requiredOption('-r, --registry [targetRegistry]', chalk.blue('[REQUIRED] Registry used for target of difference calculation. If you are using a group npm registry, make this your group registry so difference may be minimal'))
compare.action((command) => {
  let registry = command.registry

  let count = 0
  let tempReg = registry.replace(/(^\w+:|^)\/\//, '')
  tempReg = tempReg.split(':')[0]
  let hosts = [tempReg]
  hosts.forEach(function (host) {
    ping.sys.probe(host, function (isAlive) {
      count++
      if (isAlive == false) {
        console.log(chalk.red('cannot connect to: ' + host + '! exiting...'))
        process.exit(0)
      }
      if (count == hosts.length) {
        let compareExecutor = new comparator(registry)
        compareExecutor.process()
      }

    }, pingCfg)
  })
})

let fetch = new Command('fetch')
fetch.description(chalk.blue('Fetches difference between source and target registry, creates a tar file for convenient transfer to and out of airgapped env.') + chalk.red('REQUIRES SUCCESSFUL \'ndc compare\', and requires a ndc-lock.json file'))
fetch.requiredOption('-r, --registry [targetRegistry]', chalk.blue('[REQUIRED] Registry used for target of difference calculation. This is the registry that you will upload the packages too. If you are using a group npm registry, make this your group registry so difference may be minimal.'))
fetch.option('-sr, --sourceRegistry [registry]', chalk.blue('[OPTIONAL] Registry used for basis of difference calculation. This is the registry that ndc will carry packages from. Default value is "https://registry.npmjs.org"'))

fetch.action((command) => {

  let registry = command.registry
  let sourceRegistry = command.sourceRegistry
  if (sourceRegistry === undefined) {
    sourceRegistry = npmRegistery
  }
  let count = 0
  let tempReg2 = sourceRegistry.replace(/(^\w+:|^)\/\//, '')
  tempReg2 = tempReg2.split(':')[0]
  let hosts = [tempReg2]
  hosts.forEach(function (host) {
    ping.sys.probe(host, function (isAlive) {
      count++
      if (isAlive == false) {
        console.log(chalk.red('cannot connect to: ' + host + '! exiting...'))
        process.exit(0)
      }
      if (count == hosts.length) {
        let fetchExecutor = new fetcher(sourceRegistry, registry)
        fetchExecutor.process();
      }

    }, pingCfg)
  })
})

let publish = new Command('publish')
publish.description(chalk.blue('Fetches difference between source and target registry, creates a tar file for convenient transfer to and out of airgapped env. ') + chalk.red('REQUIRES SUCCESSFUL \'ndc fetch\' and requires ndc-carry.tgz file'))
publish.requiredOption('-r, --registry [targetRegistry]', chalk.blue('[REQUIRED] Registry used to publish downloaded difference. If you are using a group npm registry, make this one of the registries that is used in group, do not use group one.'))
publish.action((command) => {
  let registry = command.registry
  let count = 0
  let tempReg = registry.replace(/(^\w+:|^)\/\//, '')
  tempReg = tempReg.split(':')[0]
  let hosts = [tempReg]
  hosts.forEach(function (host) {
    ping.sys.probe(host, function (isAlive) {
      count++
      if (isAlive == false) {
        console.log(chalk.red('cannot connect to: ' + host + '! exiting...'))
        process.exit(0)
      }
      if (count == hosts.length) {
        let publishExecutor = new publisher(registry)
        publishExecutor.process()
      }

    }, pingCfg)
  })
})

let relock = new Command('relock')
relock.description(chalk.blue('Updates package-lock! Use this as your final step. ') + chalk.red('REQUIRES SUCCESSFUL ndc publish!'))
relock.requiredOption('-r, --registry [registry]', chalk.blue('[REQUIRED] Registry used to publish downloaded difference. If you are using a group npm registry, make this your group registry so right lock files will be gathered'))
relock.action((command) => {
  let registry = command.registry
  let count = 0
  let tempReg = registry.replace(/(^\w+:|^)\/\//, '')
  tempReg = tempReg.split(':')[0]
  let hosts = [tempReg]
  hosts.forEach(function (host) {
    ping.sys.probe(host, function (isAlive) {
      count++
      if (isAlive == false) {
        console.log(chalk.red('cannot connect to: ' + host + '! exiting...'))
        process.exit(0)
      }
      if (count == hosts.length) {
        let relockExecutor = new relocker(registry)
        relockExecutor.process()
      }

    }, pingCfg)
  })
})

program
  .addCommand(index)
  .addCommand(compare)
  .addCommand(fetch)
  .addCommand(publish)
  .addCommand(relock)
  .helpOption('-h, --help', chalk.blue(' display help for command'))
program.parse(process.argv)


