const publish = require('libnpmpublish')
const fs = require('fs')
const tar = require('tar')
const rimraf = require('rimraf')
const chalk = require('chalk')
const config = require('libnpmconfig')

function createOpts (registry) {
  let opts = {}
  let configs = config.read()
  let stripped = '//' + registry.replace(/(^\w+:|^)\/\//, '') + ':_authToken'
  opts.token = configs.get(stripped)
  opts.registry = registry
  if (opts.token === undefined) {
    throw Object.assign(
      new Error('Not logged in!'),
      { code: 'E401' }
    )
  }
  return opts
}

async function publishPackages (packages, registry) {
  let cnt = 0;
  try {
    let dirName = process.pid

    fs.mkdirSync('ndc-temp/' + dirName)
    for (let id in packages) {
      try {
        cnt++;
        fs.mkdirSync('ndc-temp/' + dirName + '/' + packages[id])
        tar.x(
          {
            file: 'ndc-carry/' + packages[id],
            sync: true,
            cwd: 'ndc-temp/' + dirName + '/' + packages[id]
          })
        if(!fs.existsSync('./ndc-temp/' + dirName + '/' + packages[id] + '/package/package.json')){
          throw new Error();
        }
        let manifest = JSON.parse(fs.readFileSync('./ndc-temp/' + dirName + '/' + packages[id] + '/package/package.json'))
        let opts = createOpts(registry)

        await publish.publish('./ndc-temp/' + dirName + '/' + packages[id] + '/package/', manifest, opts)
        process.send({ event: 'tick' })

      } catch
        (e) {
        if (e.code === 'EULOGIN' || e.code === 'E401') {
          console.log(chalk.red('You need to login to registry first! Please run \'npm login --registry=' + registry + '\''))
          process.send({ event: 'kill-all' })
          process.exit(0)
        } else if (e.code === 'E400') {
          process.send({ event: 'tick-have', package:packages[id]})
        } else {
          process.send({ event: 'tick-error', package:packages[id], error:e })

        }
      }finally {
        rimraf.sync('./ndc-temp/' + dirName + '/' + packages[id],{rmdirSync:true})
      }
    }
  }catch (e) {

  }
  process.send({ event: 'finish' })
  process.exit(0)
}

process.on('message', async (toGather) => {
  await publishPackages(toGather.packages, toGather.registry)

})
