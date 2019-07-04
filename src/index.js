// import { map, reduce, compose } from 'maducer';;

const CORES = navigator.hardwareConcurrency;

const BITS = {
  CHANGE: 0
};

const HEADER_SIZE = Object.keys(BITS).length;

export const init = (worker, ...args) => {
  const params = args.map(JSON.stringify);
  const blob = new Blob([`(${worker.toString()})(${params})`], {
    type: "application/javascript"
  });
  return URL.createObjectURL(blob);
};

function spawn(body, args = [], workerCount = CORES) {
  return new Array(workerCount).fill(null).map((_, index) => {
    const workerId = index + 1;
    const url = init(body, [workerId, workerCount, ...args]);
    return new Worker(url);
  });
}

function partition(data) {
  const chunkSize = Math.ceil(data.length / CORES);
  const initialState = { buffer: [], chunks: [] };
  const encoder = new TextEncoder();

  const { chunks } = data.reduce((accum, datum, index) => {
    const isChunkEnd =
      (index % chunkSize === 0 && index !== 0) || index === data.length - 1;
    const buffer = [...accum.buffer, datum];

    if (!isChunkEnd) return { ...accum, buffer };

    // Create each segment for the shared array buffer.
    const segments = {
      header: new Uint8Array(Uint8Array.BYTES_PER_ELEMENT * HEADER_SIZE),
      data: encoder.encode(buffer)
    };

    // Construct the SAB and add the header size to the payload size.
    const sab = new SharedArrayBuffer(
      segments.header.length + segments.data.length
    );

    // Write the data to the SAB for each worker to handle a chunk.
    const chunk = new Uint8Array(sab);
    chunk.set(segments.header);
    chunk.set(segments.data, HEADER_SIZE);

    return {
      ...accum,
      buffer: [],
      chunks: [...accum.chunks, chunk]
    };
  }, initialState);

  return chunks;
}

function map(mapper) {
  function worker(workerId, workerCount, mapper) {
    // console.log(workerId, workerCount);
    const apply = new Function(`return ${mapper}`)();
    self.addEventListener("message", ({ data }) => {
      console.log(data);
      //   const array = new Uint32Array(data);
      //   const a = Uint8Array.from(Array.from(new Int32Array(data)));
      //   console.log(new TextDecoder().decode(a));

      // console.log(new TextDecoder().decode(array))
    });
  }

  // Spawn each of the workers based on CPU cores available.
  const workers = spawn(worker, [mapper.toString()]);

  return data => {
    // [change, ...payload]

    const chunks = partition(data);

    // Dispatch the SABs to each of the spawned workers.
    chunks.forEach((chunk, index) => {
      const worker = workers[index];
      worker.postMessage(chunk);
    })
  };
}

// -------

async function main() {
  const ageDoubled = map(value => {
    return Number(value) * 2;
  });

  const data = await fetch("./src/data.csv").then(r => r.text());
  ageDoubled(data.split("\n"));
}

main();
