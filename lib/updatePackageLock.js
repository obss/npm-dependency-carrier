const lockUpdater = require('./children/lockUpdater')
const comparator = require('./compareDeps')
const chalk = require('chalk')
module.exports = class packageLockUpdater {
  constructor (registry) {
    this.registry=registry
  }
  process(){
    console.log(chalk.blue('Now, package-lock.json will be updated'))
    new lockUpdater(this.registry);
  }
}

