const fs = require('fs');
const chalk = require('chalk');
const {fork} = require('child_process');
const Gauge = require("gauge");
const {chunkArray} = require('./common/common');

module.exports = class Compare {
    constructor(registry) {
        this.registry = registry;
    }

    parseInstalled() {
        let file = fs.readFileSync('ndc-lock.json');
        let ndcLock
        if (file != null) {
            try {
                ndcLock = JSON.parse(file);
            } catch (e) {
                console.log(chalk.red("ndc-lock.json file is corrupted! run index again."))
                process.exit(0)
            }
        }
        let deps = Object.keys(ndcLock.dependencies);
        return deps;
    }

    updateLockFile(gatheredInformation,registry) {

        let file = fs.readFileSync('ndc-lock.json');
        let ndcLock = {}
        if (file != null) {
            try {
                ndcLock = JSON.parse(file);
            } catch (e) {
                console.log(chalk.red("ndc-lock.json file is corrupted! run index again."))
                process.exit(0)
            }
        }

        let preSaveNdcLock = JSON.parse(JSON.stringify(ndcLock));
        for (let dep in gatheredInformation) {
            if (ndcLock.dependencies[dep] == null) {
                ndcLock.dependencies[dep] = gatheredInformation[dep];
            } else {
                ndcLock.dependencies[dep].registries[registry] = gatheredInformation[dep].registries[registry];
            }

            delete preSaveNdcLock.dependencies[dep];
        }
        for (let dep in preSaveNdcLock.dependencies) {
            ndcLock.dependencies[dep].registries[registry] = {found: false};
        }
        let strignified = JSON.stringify(ndcLock, null, 2);
        fs.writeFileSync('ndc-lock.json', strignified);

        let missingCount=countMissing();
        console.log(chalk.green("ndc-lock is updated. Looks like "+missingCount+" packages are missing in "+registry))

        function countMissing () {
            let count = 0;
            for(let dep in ndcLock.dependencies){
                if (!ndcLock.dependencies[dep].registries[registry].found){
                    count++;
                }
            }
            return count;
        }
    }

    process() {
        if (!fs.existsSync("ndc-lock.json")) {
            console.log(chalk.red("there is no ndc-lock.json file! Please run ndc index first!"))
            process.exit(0);
        }
        let individualDependencies = this.parseInstalled();
        console.log(chalk.blue("Will check if " + individualDependencies.length + " dependencies present on " + this.registry));


        let concurrency = 20
        let thisRegistry=this.registry;
        let metas = {};
        let endCount = 0;
        let packageCount = 0;
        let chunks = chunkArray(individualDependencies, concurrency);
        let gauge = new Gauge();
        let func=this.updateLockFile
        for (let i = 0; i < concurrency; i++) {
            let scriptPath = __dirname + '/children/pacoteGather.js'
            let pacoteProcess = fork(scriptPath);

            let deps = chunks[i]
            if (deps != null)
                gauge.show("Checking " + this.registry + " for packages..…", 0)
            pacoteProcess.send({individualDependencies: deps, registry:this.registry})
            pacoteProcess.on('message', (message) => {
                if (message.event === "tick") {
                    packageCount++;
                    gauge.pulse();
                    gauge.show("gathering...", packageCount / individualDependencies.length)
                } else {
                    metas = Object.assign({}, metas, message.metas)
                }

            });
            pacoteProcess.on('exit', function () {
                endCount++;
                if (endCount === concurrency) {
                    gauge.hide();
                    func(metas,thisRegistry)
                }
            });
        }
    }


};
