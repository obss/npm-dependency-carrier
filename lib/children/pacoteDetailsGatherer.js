const pacote = require('pacote')

async function getPackageInformationFromRemote (packages, registry) {
  let returnMap={};
  for (let id in packages) {

    try {
      let remoteMetadata = await pacote.manifest(packages[id], {
        fullMetadata: true,
        registry: registry
      })
      returnMap[packages[id]]={};
      returnMap[packages[id]].resolved = remoteMetadata._resolved
      returnMap[packages[id]].integrity = remoteMetadata._integrity
      returnMap[packages[id]].name = remoteMetadata.name
      returnMap[packages[id]].version = remoteMetadata.version
    } catch (error) {
      console.log("cannot find these!" + packages[id])
      console.log(error)
    }
    process.send({ event: 'tick' })
  }

  return returnMap
}

process.on('message', async (data) => {

  const metas = await getPackageInformationFromRemote(data.packages, data.registry)

  process.send({ event: 'finish', metas: metas })
  process.exit(0)
})
