import maducer from 'maducer';

// new Array(10_000_000)
//     .fill(null)
//     .map(() => Math.round(Math.random() * 1000))
//     .join(',');

async function main() {
    const mapper = a => Number(a);
    const reducer = (a, b) => (a > b ? a : b);
    const compute = maducer(',', mapper, reducer);
    const data = await fetch('./data/dataset.csv').then(r => r.text());

    console.log('running standard...');
    console.time('standard');
    const result = data
        .split(',')
        .map(mapper)
        .reduce(reducer);
    console.timeEnd('standard');
    console.log('result:', result);

    console.log('---');

    console.log('running maducer...');
    console.time('maducer');
    const result_ = await compute(data);
    console.timeEnd('maducer');
    console.log('result:', result_);
}

main();
