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
    const payload =
        data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new TextEncoder().encode(data);

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
        const collection = getChunk(data).split(delimiter.decoded);

        const result = collection
            .slice(1)
            .reduce((x, y) => reduce(x, map(y)), map(collection[0]));

        self.postMessage(result);
    });

    function getDelimiterIndex(data) {
        return data.findIndex((_, index) => {
            return delimiter.encoded.every(delimiter => {
                return data[index] === delimiter;
            });
        });
    }

    function getChunk(data) {
        const chunkSize = Math.round(data.length / workerCount);
        const chunkStart = workerId * chunkSize;
        const chunkEnd = (workerId + 1) * chunkSize;

        const chunkOffsets = {
            start:
                chunkStart === 0
                    ? 0
                    : getDelimiterIndex(data.slice(chunkStart)) +
                      delimiter.encoded.length,
            end:
                chunkEnd === data.length
                    ? 0
                    : getDelimiterIndex(data.slice(chunkEnd)),
        };

        return new TextDecoder().decode(
            data.slice(
                chunkStart + chunkOffsets.start,
                chunkEnd + chunkOffsets.end,
            ),
        );
    }
}

export default function main(delimiter, mapper, reducer) {
    const workers = spawn(worker, [
        CORES,
        {
            encoded: [...new TextEncoder().encode(delimiter)],
            decoded: delimiter,
        },
        mapper.toString(),
        reducer.toString(),
    ]);

    return async payload => {
        const data = encode(payload);
        return (await dispatch(workers, data)).reduce(reducer);
    };
}
