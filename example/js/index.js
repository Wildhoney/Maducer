import maducer from 'maducer';
import numeral from 'numeral';

// new Array(10_000_000)
//     .fill(null)
//     .map(() => Math.round(Math.random() * 1000))
//     .join(',');

function formatTiming(timing) {
    return `${numeral(Math.round(timing)).format('0,0')}ms`;
}

async function main() {
    const mapper = a => Number(a);
    const reducer = (a, b) => (a > b ? a : b);
    const delimiter = ',';

    const compute = maducer(delimiter, mapper, reducer);
    const data = await fetch('./data/dataset.csv').then(r => r.text());

    console.log(`running standard...`);
    console.time('standard');
    const timeStart = window.performance.now();
    const result = data
        .split(delimiter)
        .map(mapper)
        .reduce(reducer);
    document.querySelector('strong.standard').innerHTML = formatTiming(
        window.performance.now() - timeStart,
    );
    console.timeEnd('standard');
    console.log('result:', result);

    console.log('---');

    {
        console.log(`running maducer...`);
        console.time('maducer');
        const timeStart = window.performance.now();
        const result = await compute(data);
        document.querySelector('strong.maducer').innerHTML = formatTiming(
            window.performance.now() - timeStart,
        );
        console.timeEnd('maducer');
        console.log('result:', result);
    }
}

main();
