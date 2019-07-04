// import { map, reduce, compose } from 'maducer';;

// const CORES = navigator.hardwareConcurrency;
const CORES = 1;

const BITS = {
    CHANGE: 0,
};

const HEADER_SIZE = Object.keys(BITS).length;

const init = (worker, ...args) => {
    const params = args.map(JSON.stringify);
    const blob = new Blob([`(${worker.toString()})(${params})`], {
        type: 'application/javascript',
    });
    return URL.createObjectURL(blob);
};

function spawn(body, args = [], workerCount = CORES) {
    return new Array(workerCount).fill(null).map((_, index) => {
        const url = init(body, ...args);
        return new Worker(url);
    });
}

function partition(data) {
    const chunkSize = Math.ceil(data.length / CORES);
    const initialState = { buffer: [], chunks: [] };
    const encoder = new TextEncoder();

    const { chunks } = data.reduce((accum, datum, index) => {
        const isChunkEnd =
            (index % chunkSize === 0 && index !== 0) ||
            index === data.length - 1;
        const buffer = [...accum.buffer, datum];

        if (!isChunkEnd) return { ...accum, buffer };

        // Create each segment for the shared array buffer.
        const segments = {
            header: new Uint8Array(Uint8Array.BYTES_PER_ELEMENT * HEADER_SIZE),
            data: encoder.encode(buffer.join('\n')),
        };

        // Construct the SAB and add the header size to the payload size.
        const sab = new SharedArrayBuffer(
            segments.header.length + segments.data.length,
        );

        // Merge the header and payload into the SAB for each worker to handle a chunk.
        const chunk = new Uint8Array(sab);
        chunk.set(segments.header);
        chunk.set(segments.data, HEADER_SIZE);

        return {
            ...accum,
            buffer: [],
            chunks: [...accum.chunks, chunk],
        };
    }, initialState);

    return chunks;
}

function dispatch(workers, chunks) {
    return Promise.all(
        chunks.map((chunk, index) => {
            return new Promise(resolve => {
                const worker = workers[index];
                worker.postMessage(chunk);
                worker.addEventListener('message', ({ data }) => resolve(data));
            });
        }),
    );
}

function main(mapper) {
    function worker(mapper, HEADER_SIZE) {
        const apply = new Function(`return ${mapper}`)();
        const decoder = new TextDecoder();

        self.addEventListener('message', event => {
            const payload = new Uint8Array(event.data.length);
            payload.set(event.data);
            const collection = decoder
                .decode(payload.slice(HEADER_SIZE))
                .split('\n');
            const result = collection.map(apply);
            self.postMessage(result);
        });
    }

    // Spawn each of the workers based on CPU cores available.
    const workers = spawn(worker, [mapper.toString(), HEADER_SIZE]);

    return async data => {
        // Partition the data based on the number of CPU cores.
        const chunks = partition(data);

        // Dispatch the SABs to each of the spawned workers.
        return await dispatch(workers, chunks);
    };
}

// -------

async function start() {
    const mapper = value => {
        return Number(value);
    };

    const ageDoubled = main(mapper);

    const data = await fetch('./src/small-ints.csv').then(r => r.text());
    console.time('a');
    // console.log(data.split(',').map(num => Number(num)));
    const result = await ageDoubled(data.split(','));
    console.timeEnd('a');

    console.log('result:', result);
}

start();
