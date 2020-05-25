const pacote = require('pacote');
async function getPackageInformationFromRemote(individualDependencies,registry) {

    let metadata = {};
    for (let id in individualDependencies) {
        try{
            let remoteMetadata=await pacote.manifest(individualDependencies[id],{fullMetadata:true, registry:registry});
            let name=remoteMetadata.name+'@'+remoteMetadata.version
            let found=true;
            let tarball=remoteMetadata.dist.tarball;
            metadata[name]={registries:{}};
            metadata[name].registries[registry]={found, tarball}
        }catch (error) {

        }
        process.send({event:"tick"});
    }
    return metadata;
}

process.on('message',async (toGather) => {
    const metas = await getPackageInformationFromRemote(toGather.individualDependencies, toGather.registry);

    process.send({event:"finish", metas: metas });
    process.exit(0)
});

