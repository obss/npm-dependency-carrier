# npm-dependency-carrier

npm-dependency-carrier is a command line tool to carry npm dependencies between various npm registries that may or may not have internet connection.

## Installation
First globally install application

`npm install -g @obss/npm-dependency-carrier`

After installation, you can run it with `ndc` command.

`ndc --help` is useful too.

### Why npm-dependency-carrier

We have been working in an airgapped environment to develop various js applications. During our development efforts, we saw that it is really hard to have consistent development and build environment, mainly because of npm dependencies.

We tried various techniques to move dependencies between airgapped envs and internet, but all approaches had their shortcommings. In order to fix this, we build this tool to carry differences between registries, with respect to a `package.json` file.

### How npm-dependency-carrier works

`npm-dependency-carrier` is a tool to carry dependencies between npm registries. In order to do this, it uses `npm` command line commands, `pacote` and `libnpmpublish` library to make sure that the carrying of packages is as smooth as possible.

`ndc` needs an installable project to start with. This makes sure that we can rely on `npm` to resolve depenencies, so we will not add another variable to whole processes. Let’s investigate steps.

1. `ndc index` :
This command is used to create initial lock file, called `ndc-lock.json` to find out dependencies that will be used as basis for difference calculation between registries. 

2. `ndc compare -r [private npm group registry]` :
This command is used to calculate differences between current lock file, and your target registry. If you are using multiple registries that are connected with a group registry, use group registries address here to make sure that you have a correct comparison.

3. `ndc fetch -r [private npm group registry]` : This command is used to download npm packages from soruce registry (npm registry) and tars them in `ndc-carry.tgz`. This step uses urls from `ndc-lock.json` to gather packages.

4. `ndc publish -r [private npm registry]` : This command is used to publish downloaded packages to your registry. Here for `-r`, use your target private registry, not group one. This publish stage is two phased. First phase is to use `libnpmpublish` to publish packages. This is used to override regisry settings that is defined in `package.json` for projects. However, this step might fail because of inter-dependencies, and this step ignores prepublish and postpublish scripts. So to make sure, this step also runs `npm publish --registry=[private npm registry]` on your local for packages that failed during `libnpmpublish` phase.

5. `ndc relock -r [private npm group registry]` : This command is used to fix package-lock.json files. After previous steps, your checksums will fail, so this step will use `ndc-lock.json` to fetch checksum of relevant package and update its checksum. You can delete `package-lock.json` too, since now all depenencies are carried, and it is safe to have npm recalculate dependency tree, but it is recomended to run this command and make sure everythig is safe for all team. This step will also create `old-package-lock.json` file that contains previous package lock file.

### How to carry npm-dependency-carrier to an airgapped environment

This is a step by step explanation of the process. This example assumes that you have access to 2 machines, one with internet and one without. This example assumes that you run `npm login` for intranet machine, and have global `.npmrc` file with relevant settings.

1. On an internet machine run `git clone https://github.com/obss/.npm-dependency-carrier.git` and go to project folder.
2. On the same machine install project `npm install`.
3. On the same machine run `ndc index`.
4. Copy project folder to air gapped machine.
5. On airgapped machine, run `node ndc.js compare -r [private npm group registry]` in project folder.
6. Move `ndc-lock.json` from airgapped machine to internet machine project directory.
7. On internet machine, run `ndc fetch -r [private npm group registry]` in project folder.
8. Copy `ndc-lock.json` and `ndc-carry.tgz` to airgapped machine project folder.
9. On airgapped machine, run `node ndc.js publish -r [private npm registry]` in project folder to publish all packages.
10. On airgapped machine, run `npm install` in project folder.
11. On airgapped machine, run `npm publish`.
12. On airgapped machine, run `npm install -g @obss/npm-dependency-carrier`



