const CORES = navigator.hardwareConcurrency || 4;

function init(worker, ...args) {
    const params = args.map(JSON.stringify);
    const blob = new Blob([`(${worker.toString()})(${params})`], {
        type: 'application/javascript',
    });
    return URL.createObjectURL(blob);
}

function spawn(body, args = []) {
    return new Array(CORES).fill(null).map((_, index) => {
        const workerId = index;
        const url = init(body, ...[workerId, ...args]);
        return new Worker(url);
    });
}

function encode(data) {
    const payload = new TextEncoder().encode(data);
    const sharedBuffer = new SharedArrayBuffer(payload.length);
    const chunk = new Uint8Array(sharedBuffer);
    chunk.set(payload);
    return chunk;
}

function dispatch(workers, data) {
    return Promise.all(
        workers.map(
            worker =>
                new Promise(resolve => {
                    worker.postMessage(data);
                    worker.addEventListener('message', ({ data }) =>
                        resolve(data),
                    );
                }),
        ),
    );
}

function worker(workerId, workerCount, delimiter, mapper, reducer) {
    const map = new Function(`return ${mapper}`)();
    const reduce = new Function(`return ${reducer}`)();

    self.addEventListener('message', ({ data }) => {
        const { chunkStart, chunkEnd } = getChunks(data);

        const collection = new TextDecoder()
            .decode(data.slice(chunkStart, chunkEnd))
            .split(delimiter.decoded);

        const result = collection.map(map).reduce(reduce);
        self.postMessage(result);
    });

    function findOffset(data, chunkIndex) {
        const offset = data
            .slice(chunkIndex)
            .findIndex(value => value === delimiter.encoded);
        return offset === -1 ? 0 : offset;
    }

    function getChunks(data) {
        const chunkSize = Math.round(data.length / workerCount);
        const chunkStart = workerId * chunkSize;
        const chunkEnd = (workerId + 1) * chunkSize;

        const startOffset =
            chunkStart === 0 ? 0 : findOffset(data, chunkStart) + 1;
        const endOffset = findOffset(data, chunkEnd);

        return {
            chunkStart: chunkStart + startOffset,
            chunkEnd: chunkEnd + endOffset,
        };
    }
}

export default function main(delimiter, mapper, reducer) {
    const workers = spawn(worker, [
        CORES,
        { encoded: new TextEncoder().encode(delimiter)[0], decoded: delimiter },
        mapper.toString(),
        reducer.toString(),
    ]);

    return async payload => {
        const data = encode(payload);
        return (await dispatch(workers, data)).reduce(reducer);
    };
}
