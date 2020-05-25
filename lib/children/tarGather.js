const http = require('http')
const https = require('https')
const fs = require('fs')

async function downloadPackagesFunction (downloadPackages, registry) {
  try {
    let count = 0
    let requester = http
    if (registry.indexOf('https://') >= 0) {
      requester = https
    }

    if(downloadPackages === undefined || downloadPackages.length===0){
      process.send({ event: 'finish' })
      process.exit(0)
    }
    for (let id in downloadPackages) {

      let tarballUrl = downloadPackages[id][1].registries[registry].tarball
      let filename = 'ndc-carry/' + tarballUrl.substring(tarballUrl.lastIndexOf('/') + 1)
      let file = fs.createWriteStream(filename)

      let req=await requester.get(tarballUrl, {timeout:1000}, function (response) {
        let stream=response.pipe(file)
        stream.on('finish', ()=>{
          process.send({ event: 'tick' })
          count++
          if(count == downloadPackages.length){
            process.send({ event: 'finish' })
            process.exit(0)
          }
        })
        stream.on('error', (e)=>{

        })

      })
      req.setTimeout(100000);
      req.on('timeout',()=>{
        req.abort();
        req.end();
      })
      req.on('error',(e)=>{
        if(e.code==='ECONNRESET'){
          count++
          process.send({event:'tick-error',package:downloadPackages[id]})
          if(count == downloadPackages.length){
            process.send({ event: 'finish' })
            process.exit(0)
          }
        }
      })
    }


  } catch (e) {
    console.log(e)
  }
}

process.on('message', async (toGather) => {
  await downloadPackagesFunction(toGather.downloadPackages, toGather.registry)

})

