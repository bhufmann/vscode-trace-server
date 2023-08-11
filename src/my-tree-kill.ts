
import { ChildProcess, spawn, exec, ChildProcessWithoutNullStreams } from 'child_process';



export async function myTreeKill(log: (el : string) => void, pid2: number, signal?: any, callback?: (arg0?: unknown) => any) {
    if (typeof signal === 'function' && callback === undefined) {
        callback = signal;
        signal = undefined;
    }

    const pid = parseInt(pid2.toString());
    log('here1 ' + pid)
    if (Number.isNaN(pid)) {
        log('here2')
        if (callback) {
            log('here3')
            return callback(new Error("pid must be a number"));
        } else {
            log('here4')
            throw new Error("pid must be a number");
        }
    }

    log('here5')
    const tree: { [index: string]: any } = {};
    const pidsToProcess: { [index: string]: any } = {};
    tree[pid] = [];
    pidsToProcess[pid] = 1;

    switch (process.platform) {
        case 'win32':
            exec('taskkill /pid ' + pid + ' /T /F', callback);
            break;
        case 'darwin':
            buildProcessTree(log, pid, tree, pidsToProcess, function (parentPid: string) {
                return spawn('pgrep', ['-P', parentPid]);
            }, function () {
                killAll(tree, signal, callback);
            });
            break;
        // case 'sunos':
        //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
        //         killAll(tree, signal, callback);
        //     });
        //     break;
        default: // Linux
            log('here6');

            // spawn('/home/bernd/bin/myPs.sh', [pid.toString()]);

            // const bla = spawn('echo', ['Aber Hallo']);
            // bla.stdout.on('data', function (data: any) {
            //     log(data.toString('ascii'));
            // });

            buildProcessTree(log, pid, tree, pidsToProcess, function (parentPid: string) {
                log('here7 ' + parentPid)
                const res = spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
                res.once('exit', () => {
                    log('here7.7 ' + res.pid);    
                });
                log('here8 ' + res.pid);
                return res;
            }, function () {
                killAll(tree, signal, callback);
            });
            break;
    }
};

async function killAll(tree: { [x: string]: any[]; }, signal: any, callback?: (arg0?: unknown) => any) {
    const killed: { [index: string]: any } = {};
    try {
        Object.keys(tree).forEach(function (pid) {
            tree[pid].forEach(function (pidpid) {
                if (!killed[pidpid]) {
                    killPid(pidpid, signal);
                    killed[pidpid] = 1;
                }
            });
            if (!killed[pid]) {
                killPid(pid, signal);
                killed[pid] = 1;
            }
        });
    } catch (err) {
        if (callback) {
            return callback(err);
        } else {
            throw err;
        }
    }
    if (callback) {
        return callback();
    }
}

function killPid(pid: string, signal: string | number | undefined) {
    try {
        process.kill(parseInt(pid, 10), signal);
    }
    catch (err) {
        // if (err?.code !== 'ESRCH') throw err;
    }
}

async function buildProcessTree(log: (el : string) => void, parentPid: string | number, tree: { [x: string]: number[]; }, pidsToProcess: { [x: string]: number; }, spawnChildProcessesList: { (parentPid: any): ChildProcessWithoutNullStreams; (parentPid: any): ChildProcessWithoutNullStreams; (arg0: any): any; }, cb: { (): void; (): void; (): void; }) {
    log('hallo1');
    const ps = spawnChildProcessesList(parentPid);
    let allData = '';
    log('here1.1 ' + ps.pid);
    ps.stdout.on('data', function (data: any) {
        log('here1.2' + data);
        data = data.toString('ascii');
        allData += data;
    });

    log('hallo2 ' + allData);
    const onClose = function (code: number) {
        delete pidsToProcess[parentPid];
        log('hallo3');
        if (code != 0) {
            log('hallo4');
            // no more parent processes
            if (Object.keys(pidsToProcess).length == 0) {
                log('hallo5');
                cb();
            }
            log('hallo6');
            return;
        }
        log('hallo7');
        const match = allData.match(/\d+/g);
        if (match) {
            log('hallo8');
            match.forEach(function (pid) {
                const pid2 = parseInt(pid, 10);
                log('hallo9 ' + pid);
                tree[parentPid].push(pid2);
                tree[pid2] = [];
                pidsToProcess[pid2] = 1;
                buildProcessTree(log, pid2, tree, pidsToProcess, spawnChildProcessesList, cb);
                log('hallo10');
            });
        }
    };
    log('hallo11');
    ps.on('close', onClose);
    log('hallo12')
}
